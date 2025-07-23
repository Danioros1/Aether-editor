import { Queue, Job, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { RenderJobType } from '../../../../packages/types/dist';

export interface JobQueueHealth {
  isHealthy: boolean;
  activeJobs: number;
  waitingJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
  redisConnected: boolean;
  workerConnected: boolean;
  lastHealthCheck: Date;
  errors: string[];
}

export interface JobRetryConfig {
  maxAttempts: number;
  backoffType: 'exponential' | 'fixed';
  backoffDelay: number;
  retryCondition?: (error: Error) => boolean;
}

export interface JobMonitoringConfig {
  healthCheckInterval: number; // milliseconds
  alertThresholds: {
    maxFailedJobs: number;
    maxQueuedJobs: number;
    maxProcessingTime: number; // milliseconds
  };
  enableAlerts: boolean;
}

export class JobQueueManager {
  private queue: Queue;
  private queueEvents: QueueEvents;
  private redis: Redis;
  private healthStatus: JobQueueHealth;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private config: JobMonitoringConfig;
  private retryConfig: JobRetryConfig;
  private alertCallbacks: Array<(health: JobQueueHealth) => void> = [];

  constructor(
    redis: Redis,
    queueName: string = 'video-render',
    config: Partial<JobMonitoringConfig> = {},
    retryConfig: Partial<JobRetryConfig> = {}
  ) {
    this.redis = redis;
    
    // Default configuration
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      alertThresholds: {
        maxFailedJobs: 10,
        maxQueuedJobs: 100,
        maxProcessingTime: 10 * 60 * 1000 // 10 minutes
      },
      enableAlerts: true,
      ...config
    };

    this.retryConfig = {
      maxAttempts: 3,
      backoffType: 'exponential',
      backoffDelay: 2000,
      retryCondition: (error: Error) => {
        // Don't retry validation errors or file not found errors
        const nonRetryableErrors = [
          'VALIDATION_FAILED',
          'FILE_NOT_FOUND',
          'INVALID_PROJECT_DATA',
          'EMPTY_PROJECT'
        ];
        return !nonRetryableErrors.some(code => error.message.includes(code));
      },
      ...retryConfig
    };

    // Initialize queue with enhanced configuration
    this.queue = new Queue(queueName, {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 50, // Keep more completed jobs for monitoring
        removeOnFail: 100,    // Keep more failed jobs for analysis
        attempts: this.retryConfig.maxAttempts,
        backoff: {
          type: this.retryConfig.backoffType,
          delay: this.retryConfig.backoffDelay,
        },
        // Add job timeout
        // timeout: this.config.alertThresholds.maxProcessingTime, // Not supported in BullMQ DefaultJobOptions
      },
    });

    // Initialize queue events for monitoring
    this.queueEvents = new QueueEvents(queueName, {
      connection: redis
    });

    // Initialize health status
    this.healthStatus = {
      isHealthy: true,
      activeJobs: 0,
      waitingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      delayedJobs: 0,
      redisConnected: false,
      workerConnected: false,
      lastHealthCheck: new Date(),
      errors: []
    };

    this.setupEventListeners();
    this.startHealthChecking();
  }

  private setupEventListeners(): void {
    // Queue events
    this.queueEvents.on('completed', (jobInfo) => {
      console.log(`✅ Job completed: ${jobInfo.jobId}`);
      this.updateHealthStatus();
    });

    this.queueEvents.on('failed', (jobInfo, error) => {
      console.error(`❌ Job failed: ${jobInfo.jobId}`, error);
      this.handleJobFailure(jobInfo, error);
      this.updateHealthStatus();
    });

    this.queueEvents.on('active', (jobInfo) => {
      console.log(`🎬 Job started: ${jobInfo.jobId}`);
      this.updateHealthStatus();
    });

    this.queueEvents.on('stalled', (jobInfo) => {
      console.warn(`⚠️ Job stalled: ${jobInfo.jobId}`);
      this.handleJobStall(jobInfo);
      this.updateHealthStatus();
    });

    this.queueEvents.on('progress', (jobInfo, progress) => {
      console.log(`📊 Job progress: ${jobInfo.jobId} - ${JSON.stringify(progress)}`);
    });

    // Redis connection events
    this.redis.on('connect', () => {
      console.log('✅ JobQueueManager: Redis connected');
      this.healthStatus.redisConnected = true;
      this.updateHealthStatus();
    });

    this.redis.on('error', (error) => {
      console.error('❌ JobQueueManager: Redis error:', error);
      this.healthStatus.redisConnected = false;
      this.healthStatus.errors.push(`Redis error: ${error.message}`);
      this.updateHealthStatus();
    });

    this.redis.on('close', () => {
      console.warn('⚠️ JobQueueManager: Redis connection closed');
      this.healthStatus.redisConnected = false;
      this.updateHealthStatus();
    });
  }

  private async handleJobFailure(jobInfo: any, error: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobInfo.jobId);
      if (!job) return;

      const shouldRetry = this.retryConfig.retryCondition 
        ? this.retryConfig.retryCondition(new Error(error))
        : true;

      if (!shouldRetry) {
        console.log(`🚫 Job ${jobInfo.jobId} will not be retried due to error type`);
        return;
      }

      // Log failure details
      console.error(`❌ Job failure details:`, {
        jobId: jobInfo.jobId,
        attempt: job.attemptsMade,
        maxAttempts: this.retryConfig.maxAttempts,
        error,
        data: job.data
      });

      // If max attempts reached, handle permanent failure
      if (job.attemptsMade >= this.retryConfig.maxAttempts) {
        await this.handlePermanentJobFailure(job, error);
      }

    } catch (err) {
      console.error('Error handling job failure:', err);
    }
  }

  private async handleJobStall(jobInfo: any): Promise<void> {
    try {
      const job = await this.queue.getJob(jobInfo.jobId);
      if (!job) return;

      console.warn(`⚠️ Job stalled - attempting recovery:`, {
        jobId: jobInfo.jobId,
        attempt: job.attemptsMade,
        data: job.data
      });

      // Optionally restart stalled jobs
      // await job.retry();

    } catch (err) {
      console.error('Error handling job stall:', err);
    }
  }

  private async handlePermanentJobFailure(job: Job, error: string): Promise<void> {
    console.error(`💀 Permanent job failure:`, {
      jobId: job.id,
      attempts: job.attemptsMade,
      error,
      data: job.data
    });

    // Here you could implement additional failure handling:
    // - Send notifications
    // - Log to external monitoring service
    // - Clean up resources
    // - Update database records
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.updateHealthStatus();
    }, this.config.healthCheckInterval);

    // Initial health check
    this.updateHealthStatus();
  }

  private async updateHealthStatus(): Promise<void> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed()
      ]);

      const previousHealth = this.healthStatus.isHealthy;

      this.healthStatus = {
        isHealthy: true,
        activeJobs: active.length,
        waitingJobs: waiting.length,
        completedJobs: completed.length,
        failedJobs: failed.length,
        delayedJobs: delayed.length,
        redisConnected: this.redis.status === 'ready',
        workerConnected: true, // This would need to be updated by worker
        lastHealthCheck: new Date(),
        errors: []
      };

      // Check health thresholds
      if (this.healthStatus.failedJobs > this.config.alertThresholds.maxFailedJobs) {
        this.healthStatus.isHealthy = false;
        this.healthStatus.errors.push(`Too many failed jobs: ${this.healthStatus.failedJobs}`);
      }

      if (this.healthStatus.waitingJobs > this.config.alertThresholds.maxQueuedJobs) {
        this.healthStatus.isHealthy = false;
        this.healthStatus.errors.push(`Too many queued jobs: ${this.healthStatus.waitingJobs}`);
      }

      if (!this.healthStatus.redisConnected) {
        this.healthStatus.isHealthy = false;
        this.healthStatus.errors.push('Redis connection lost');
      }

      // Trigger alerts if health status changed
      if (this.config.enableAlerts && previousHealth !== this.healthStatus.isHealthy) {
        this.triggerHealthAlert();
      }

    } catch (error) {
      console.error('Error updating health status:', error);
      this.healthStatus.isHealthy = false;
      this.healthStatus.errors.push(`Health check failed: ${(error as Error).message}`);
    }
  }

  private triggerHealthAlert(): void {
    console.log(`🚨 Queue health status changed: ${this.healthStatus.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    if (!this.healthStatus.isHealthy) {
      console.error('🚨 Queue health issues:', this.healthStatus.errors);
    }

    // Notify all registered alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(this.healthStatus);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }

  // Public methods
  public async addJob(jobData: RenderJobType, options: any = {}): Promise<Job> {
    try {
      const job = await this.queue.add('render-video', jobData, {
        ...options,
        // Override with our retry configuration
        attempts: this.retryConfig.maxAttempts,
        backoff: {
          type: this.retryConfig.backoffType,
          delay: this.retryConfig.backoffDelay,
        },
      });

      console.log(`📹 Render job queued: ${job.id}`);
      return job;

    } catch (error) {
      console.error('Error adding job to queue:', error);
      throw error;
    }
  }

  public async getJob(jobId: string): Promise<Job | null> {
    return (await this.queue.getJob(jobId)) || null;
  }

  public getHealthStatus(): JobQueueHealth {
    return { ...this.healthStatus };
  }

  public onHealthAlert(callback: (health: JobQueueHealth) => void): void {
    this.alertCallbacks.push(callback);
  }

  public async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0
    };
  }

  public async cleanFailedJobs(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const failed = await this.queue.getFailed();
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const job of failed) {
      if (job.timestamp < cutoff) {
        await job.remove();
        cleaned++;
      }
    }

    console.log(`🧹 Cleaned ${cleaned} old failed jobs`);
    return cleaned;
  }

  public async retryFailedJobs(maxJobs: number = 10): Promise<number> {
    const failed = await this.queue.getFailed(0, maxJobs - 1);
    let retried = 0;

    for (const job of failed) {
      try {
        if (this.retryConfig.retryCondition) {
          const shouldRetry = this.retryConfig.retryCondition(new Error(job.failedReason || 'Unknown error'));
          if (!shouldRetry) continue;
        }

        await job.retry();
        retried++;
        console.log(`🔄 Retried failed job: ${job.id}`);
      } catch (error) {
        console.error(`Failed to retry job ${job.id}:`, error);
      }
    }

    console.log(`🔄 Retried ${retried} failed jobs`);
    return retried;
  }

  public async pauseQueue(): Promise<void> {
    await this.queue.pause();
    console.log('⏸️ Queue paused');
  }

  public async resumeQueue(): Promise<void> {
    await this.queue.resume();
    console.log('▶️ Queue resumed');
  }

  public async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.queueEvents.close();
    await this.queue.close();
    console.log('✅ JobQueueManager closed');
  }
}

export default JobQueueManager;