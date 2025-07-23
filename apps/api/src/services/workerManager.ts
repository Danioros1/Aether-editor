import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { RenderJobType } from '../../../../packages/types/dist';

export interface WorkerHealth {
  isHealthy: boolean;
  isActive: boolean;
  processedJobs: number;
  failedJobs: number;
  lastJobTime: Date | null;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  errors: string[];
  lastHealthCheck: Date;
}

export interface WorkerConfig {
  concurrency: number;
  maxJobTime: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  autoRestart: boolean;
  maxRestarts: number;
  restartDelay: number; // milliseconds
}

export class WorkerManager {
  private worker: Worker | null = null;
  private redis: Redis;
  private queueName: string;
  private config: WorkerConfig;
  private health: WorkerHealth;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private restartCount: number = 0;
  private startTime: Date;
  private jobProcessor: (job: Job<RenderJobType>) => Promise<any>;
  private isShuttingDown: boolean = false;

  constructor(
    redis: Redis,
    queueName: string,
    jobProcessor: (job: Job<RenderJobType>) => Promise<any>,
    config: Partial<WorkerConfig> = {}
  ) {
    this.redis = redis;
    this.queueName = queueName;
    this.jobProcessor = jobProcessor;
    this.startTime = new Date();

    this.config = {
      concurrency: 1,
      maxJobTime: 30 * 60 * 1000, // 30 minutes
      healthCheckInterval: 30000, // 30 seconds
      autoRestart: true,
      maxRestarts: 5,
      restartDelay: 5000, // 5 seconds
      ...config
    };

    this.health = {
      isHealthy: true,
      isActive: false,
      processedJobs: 0,
      failedJobs: 0,
      lastJobTime: null,
      uptime: 0,
      memoryUsage: process.memoryUsage(),
      errors: [],
      lastHealthCheck: new Date()
    };

    this.startWorker();
    this.startHealthMonitoring();
  }

  private startWorker(): void {
    try {
      console.log('🎬 Starting render worker...');

      this.worker = new Worker(
        this.queueName,
        async (job: Job<RenderJobType>) => {
          this.health.lastJobTime = new Date();
          
          try {
            const result = await this.jobProcessor(job);
            this.health.processedJobs++;
            return result;
          } catch (error) {
            this.health.failedJobs++;
            throw error;
          }
        },
        {
          connection: this.redis,
          concurrency: this.config.concurrency,
          // Add job timeout
          // settings: {
          //   // stalledInterval: 30000, // Not supported in AdvancedOptions
          //   maxStalledCount: 1, // Max number of times a job can be stalled
          // }
        }
      );

      this.setupWorkerEventListeners();
      this.health.isActive = true;
      this.health.isHealthy = true;
      this.health.errors = [];

      console.log('✅ Render worker started successfully');

    } catch (error) {
      console.error('❌ Failed to start worker:', error);
      this.health.isHealthy = false;
      this.health.errors.push(`Worker start failed: ${(error as Error).message}`);
      
      if (this.config.autoRestart && this.restartCount < this.config.maxRestarts) {
        this.scheduleRestart();
      }
    }
  }

  private setupWorkerEventListeners(): void {
    if (!this.worker) return;

    this.worker.on('ready', () => {
      console.log('🎬 Worker is ready');
      this.health.isActive = true;
      this.health.isHealthy = true;
    });

    this.worker.on('active', (job) => {
      console.log(`🎬 Processing job: ${job.id}`);
      this.health.lastJobTime = new Date();
    });

    this.worker.on('completed', (job, result) => {
      console.log(`✅ Job completed: ${job.id}`);
      this.health.processedJobs++;
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job failed: ${job?.id}`, err);
      this.health.failedJobs++;
      this.health.errors.push(`Job ${job?.id} failed: ${err.message}`);
      
      // Keep only last 10 errors
      if (this.health.errors.length > 10) {
        this.health.errors = this.health.errors.slice(-10);
      }
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`⚠️ Job stalled: ${jobId}`);
      this.health.errors.push(`Job ${jobId} stalled`);
    });

    this.worker.on('error', (err) => {
      console.error('❌ Worker error:', err);
      this.health.isHealthy = false;
      this.health.errors.push(`Worker error: ${err.message}`);
      
      if (this.config.autoRestart && this.restartCount < this.config.maxRestarts) {
        this.scheduleRestart();
      }
    });

    this.worker.on('closed', () => {
      console.log('🛑 Worker closed');
      this.health.isActive = false;
      
      if (!this.isShuttingDown && this.config.autoRestart && this.restartCount < this.config.maxRestarts) {
        this.scheduleRestart();
      }
    });
  }

  private scheduleRestart(): void {
    if (this.isShuttingDown) return;

    this.restartCount++;
    console.log(`🔄 Scheduling worker restart (attempt ${this.restartCount}/${this.config.maxRestarts}) in ${this.config.restartDelay}ms`);

    setTimeout(() => {
      if (!this.isShuttingDown) {
        this.restartWorker();
      }
    }, this.config.restartDelay);
  }

  private async restartWorker(): Promise<void> {
    try {
      console.log('🔄 Restarting worker...');
      
      // Close existing worker
      if (this.worker) {
        await this.worker.close();
        this.worker = null;
      }

      // Start new worker
      this.startWorker();

    } catch (error) {
      console.error('❌ Failed to restart worker:', error);
      this.health.isHealthy = false;
      this.health.errors.push(`Worker restart failed: ${(error as Error).message}`);
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.updateHealthStatus();
    }, this.config.healthCheckInterval);

    // Initial health check
    this.updateHealthStatus();
  }

  private updateHealthStatus(): void {
    const now = new Date();
    
    this.health.uptime = now.getTime() - this.startTime.getTime();
    this.health.memoryUsage = process.memoryUsage();
    this.health.lastHealthCheck = now;

    // Check if worker is responsive
    const isWorkerActive = Boolean(this.worker && !this.worker.closing);
    const hasRecentActivity = this.health.lastJobTime && 
      (now.getTime() - this.health.lastJobTime.getTime()) < this.config.maxJobTime;

    // Update health status
    const wasHealthy = this.health.isHealthy;
    this.health.isHealthy = isWorkerActive && 
      (this.health.processedJobs > 0 || hasRecentActivity || this.health.uptime < 60000); // Allow 1 minute startup time

    // Check memory usage (alert if over 1GB)
    const memoryMB = this.health.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryMB > 1024) {
      this.health.errors.push(`High memory usage: ${memoryMB.toFixed(2)}MB`);
    }

    // Log health status changes
    if (wasHealthy !== this.health.isHealthy) {
      if (this.health.isHealthy) {
        console.log('✅ Worker health restored');
      } else {
        console.error('❌ Worker health degraded:', this.health.errors);
      }
    }
  }

  // Public methods
  public getHealth(): WorkerHealth {
    return { ...this.health };
  }

  public async pause(): Promise<void> {
    if (this.worker) {
      await this.worker.pause();
      console.log('⏸️ Worker paused');
    }
  }

  public async resume(): Promise<void> {
    if (this.worker) {
      await this.worker.resume();
      console.log('▶️ Worker resumed');
    }
  }

  public async forceRestart(): Promise<void> {
    console.log('🔄 Force restarting worker...');
    await this.restartWorker();
  }

  public resetRestartCount(): void {
    this.restartCount = 0;
    console.log('🔄 Worker restart count reset');
  }

  public getStats(): {
    processedJobs: number;
    failedJobs: number;
    uptime: number;
    restartCount: number;
    memoryUsage: NodeJS.MemoryUsage;
  } {
    return {
      processedJobs: this.health.processedJobs,
      failedJobs: this.health.failedJobs,
      uptime: this.health.uptime,
      restartCount: this.restartCount,
      memoryUsage: this.health.memoryUsage
    };
  }

  public async close(): Promise<void> {
    console.log('🛑 Shutting down worker manager...');
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    this.health.isActive = false;
    console.log('✅ Worker manager shut down');
  }
}

export default WorkerManager;