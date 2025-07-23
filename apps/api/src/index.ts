import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AetherProjectSchema, ExportSettingsSchema, RenderJobSchema } from '../../../packages/types/dist';
import { initializeUploadRoutes } from './routes/upload';
import { cleanupOldProgress } from './middleware/uploadValidation';
import JobQueueManager from './services/jobQueueManager';
import RedisManager from './services/redisManager';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads and downloads directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const downloadsDir = path.join(__dirname, '../downloads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Initialize upload routes
const uploadRouter = initializeUploadRoutes(uploadsDir);

// Create Redis manager with resilience features
const redisManager = new RedisManager({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  enableAutoPipelining: true
});

// Create enhanced job queue manager with Redis manager
const jobQueueManager = new JobQueueManager(redisManager.getRedisInstance()!, 'video-render', {
  healthCheckInterval: 30000,
  alertThresholds: {
    maxFailedJobs: 10,
    maxQueuedJobs: 100,
    maxProcessingTime: 15 * 60 * 1000 // 15 minutes
  },
  enableAlerts: true
}, {
  maxAttempts: 3,
  backoffType: 'exponential',
  backoffDelay: 2000
});

// Handle Redis manager events
redisManager.on('connected', () => {
  console.log('✅ Redis manager connected');
});

redisManager.on('disconnected', () => {
  console.warn('⚠️ Redis manager disconnected');
});

redisManager.on('error', (error) => {
  console.error('❌ Redis manager error:', error);
});

redisManager.on('ready', () => {
  console.log('🚀 Redis manager is ready');
});

redisManager.on('reconnecting', () => {
  console.log('🔄 Redis manager reconnecting...');
});

redisManager.on('maxReconnectAttemptsReached', () => {
  console.error('💀 Redis manager: Max reconnection attempts reached');
  // Here you could implement additional fallback logic
});

// Setup job queue health monitoring
jobQueueManager.onHealthAlert((health) => {
  if (!health.isHealthy) {
    console.error('🚨 Job queue health alert:', {
      errors: health.errors,
      activeJobs: health.activeJobs,
      failedJobs: health.failedJobs,
      waitingJobs: health.waitingJobs
    });
    
    // Here you could implement additional alerting:
    // - Send email notifications
    // - Post to Slack/Discord
    // - Log to external monitoring service
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Common Vite and React dev server ports
  credentials: true
}));
app.use(express.json());

// Serve static files from uploads and downloads directories
app.use('/uploads', express.static(uploadsDir));
app.use('/downloads', express.static(downloadsDir));

// Use upload routes
app.use('/api/upload', uploadRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'aether-editor-api'
  });
});

// Basic API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Aether Editor API',
    version: '1.0.0',
    status: 'running'
  });
});

// Periodic cleanup of old upload progress entries (every 30 minutes)
setInterval(() => {
  cleanupOldProgress(60); // Clean up entries older than 60 minutes
}, 30 * 60 * 1000);

// Render endpoint - Create video render job
app.post('/api/render', async (req, res) => {
  try {
    // Validate request body structure
    const requestSchema = RenderJobSchema.omit({ jobId: true });
    const validationResult = requestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        message: 'Request body does not match expected schema',
        details: validationResult.error.errors.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      });
    }

    const { projectData, exportSettings } = validationResult.data;

    // Additional validation: Check if project has clips to render
    const hasVideoClips = projectData.timeline.videoTracks.some((track: any) => track.length > 0);
    const hasAudioClips = projectData.timeline.audioTracks.some((track: any) => track.length > 0);

    if (!hasVideoClips && !hasAudioClips) {
      return res.status(400).json({
        error: 'Empty project',
        message: 'Project must contain at least one video or audio clip to render'
      });
    }

    // Generate unique job ID
    const jobId = `render-${Date.now()}-${uuidv4()}`;

    // Create render job data
    const renderJobData = {
      projectData,
      exportSettings,
      jobId,
      createdAt: new Date().toISOString(),
      status: 'queued'
    };

    // Add job to enhanced queue
    const job = await jobQueueManager.addJob(renderJobData, {
      jobId,
      priority: 1,
      delay: 0
    });

    console.log(`📹 Render job created: ${jobId}`);

    // Return job information to client
    res.status(202).json({
      success: true,
      jobId,
      message: 'Render job created successfully',
      status: 'queued',
      createdAt: renderJobData.createdAt,
      estimatedDuration: projectData.projectSettings.duration
    });

  } catch (error) {
    console.error('Render job creation error:', error);

    // Handle specific Redis/BullMQ errors
    if (error instanceof Error) {
      if (error.message.includes('Redis') || error.message.includes('ECONNREFUSED')) {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Unable to connect to job queue service. Please try again later.'
        });
      }
    }

    res.status(500).json({
      error: 'Render job creation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get render job status
app.get('/api/render/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        error: 'Invalid job ID',
        message: 'Job ID must be provided as a string'
      });
    }

    // Get job from queue
    const job = await jobQueueManager.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Render job with ID ${jobId} was not found`
      });
    }

    // Get job state and progress
    const state = await job.getState();
    const progress = job.progress;
    const failedReason = job.failedReason;
    const processedOn = job.processedOn;
    const finishedOn = job.finishedOn;

    // Prepare response data
    const jobStatus: any = {
      jobId,
      status: state,
      progress: typeof progress === 'number' ? progress : 0,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: processedOn ? new Date(processedOn).toISOString() : null,
      finishedAt: finishedOn ? new Date(finishedOn).toISOString() : null,
      failedReason: failedReason || null,
      data: job.data
    };

    // Add download URL if job is completed successfully
    if (state === 'completed' && job.returnvalue?.outputPath) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      jobStatus.downloadUrl = `${baseUrl}/downloads/${path.basename(job.returnvalue.outputPath)}`;
    }

    res.status(200).json({
      success: true,
      job: jobStatus
    });

  } catch (error) {
    console.error('Job status retrieval error:', error);

    res.status(500).json({
      error: 'Failed to retrieve job status',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Queue monitoring endpoints
app.get('/api/queue/health', async (req, res) => {
  try {
    const health = jobQueueManager.getHealthStatus();
    res.status(200).json({
      success: true,
      health
    });
  } catch (error) {
    console.error('Queue health check error:', error);
    res.status(500).json({
      success: false,
      error: 'HEALTH_CHECK_FAILED',
      message: 'Failed to retrieve queue health status'
    });
  }
});

app.get('/api/queue/stats', async (req, res) => {
  try {
    const counts = await jobQueueManager.getJobCounts();
    const health = jobQueueManager.getHealthStatus();
    
    res.status(200).json({
      success: true,
      stats: {
        ...counts,
        redisConnected: health.redisConnected,
        lastHealthCheck: health.lastHealthCheck
      }
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({
      success: false,
      error: 'STATS_FAILED',
      message: 'Failed to retrieve queue statistics'
    });
  }
});

app.post('/api/queue/retry-failed', async (req, res) => {
  try {
    const { maxJobs = 10 } = req.body;
    const retriedCount = await jobQueueManager.retryFailedJobs(maxJobs);
    
    res.status(200).json({
      success: true,
      message: `Retried ${retriedCount} failed jobs`,
      retriedCount
    });
  } catch (error) {
    console.error('Retry failed jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'RETRY_FAILED',
      message: 'Failed to retry failed jobs'
    });
  }
});

app.post('/api/queue/clean-failed', async (req, res) => {
  try {
    const { maxAge = 24 * 60 * 60 * 1000 } = req.body; // Default 24 hours
    const cleanedCount = await jobQueueManager.cleanFailedJobs(maxAge);
    
    res.status(200).json({
      success: true,
      message: `Cleaned ${cleanedCount} old failed jobs`,
      cleanedCount
    });
  } catch (error) {
    console.error('Clean failed jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'CLEAN_FAILED',
      message: 'Failed to clean failed jobs'
    });
  }
});

app.post('/api/queue/pause', async (req, res) => {
  try {
    await jobQueueManager.pauseQueue();
    res.status(200).json({
      success: true,
      message: 'Queue paused successfully'
    });
  } catch (error) {
    console.error('Pause queue error:', error);
    res.status(500).json({
      success: false,
      error: 'PAUSE_FAILED',
      message: 'Failed to pause queue'
    });
  }
});

app.post('/api/queue/resume', async (req, res) => {
  try {
    await jobQueueManager.resumeQueue();
    res.status(200).json({
      success: true,
      message: 'Queue resumed successfully'
    });
  } catch (error) {
    console.error('Resume queue error:', error);
    res.status(500).json({
      success: false,
      error: 'RESUME_FAILED',
      message: 'Failed to resume queue'
    });
  }
});

// Redis monitoring endpoints
app.get('/api/redis/health', async (req, res) => {
  try {
    const health = redisManager.getHealth();
    res.status(200).json({
      success: true,
      health
    });
  } catch (error) {
    console.error('Redis health check error:', error);
    res.status(500).json({
      success: false,
      error: 'REDIS_HEALTH_CHECK_FAILED',
      message: 'Failed to retrieve Redis health status'
    });
  }
});

app.post('/api/redis/reconnect', async (req, res) => {
  try {
    await redisManager.forceReconnect();
    res.status(200).json({
      success: true,
      message: 'Redis reconnection initiated'
    });
  } catch (error) {
    console.error('Redis reconnect error:', error);
    res.status(500).json({
      success: false,
      error: 'REDIS_RECONNECT_FAILED',
      message: 'Failed to reconnect to Redis'
    });
  }
});

app.post('/api/redis/reset-attempts', async (req, res) => {
  try {
    redisManager.resetConnectionAttempts();
    res.status(200).json({
      success: true,
      message: 'Redis connection attempts reset'
    });
  } catch (error) {
    console.error('Redis reset attempts error:', error);
    res.status(500).json({
      success: false,
      error: 'REDIS_RESET_FAILED',
      message: 'Failed to reset Redis connection attempts'
    });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Aether Editor API server running on port ${PORT}`);
  console.log(`📋 Health check available at http://localhost:${PORT}/health`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`📁 Downloads directory: ${downloadsDir}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close HTTP server
    server.close(() => {
      console.log('✅ HTTP server closed');
    });

    // Close job queue manager
    await jobQueueManager.close();
    console.log('✅ Job queue manager closed');

    // Close Redis manager
    await redisManager.close();
    console.log('✅ Redis manager closed');

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export default app;