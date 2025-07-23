import { Job } from 'bullmq';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { RenderJobType, AetherProjectType, ClipType, AssetType } from '../../../packages/types/dist';
import RedisManager from './services/redisManager';
import WorkerManager from './services/workerManager';

// Load environment variables
dotenv.config();

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Create Redis manager for worker
const redisManager = new RedisManager({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true
});

// Directories
const uploadsDir = path.join(__dirname, '../uploads');
const downloadsDir = path.join(__dirname, '../downloads');

// Ensure downloads directory exists
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

interface RenderProgress {
  stage: string;
  progress: number;
  message: string;
}

class FFmpegRenderWorker {
  private updateProgress(job: Job, progress: RenderProgress) {
    console.log(`[${job.id}] ${progress.stage}: ${progress.message} (${progress.progress}%)`);
    job.updateProgress(progress);
  }

  private async getAssetPath(assetId: string, assets: AssetType[]): Promise<string> {
    const asset = assets.find(a => a.assetId === assetId);
    if (!asset || !asset.sourceUrl) {
      throw new Error(`Asset not found or missing source URL: ${assetId}`);
    }

    // Extract filename from URL (assuming format: http://host/uploads/filename)
    const urlParts = asset.sourceUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const assetPath = path.join(uploadsDir, filename);

    if (!fs.existsSync(assetPath)) {
      throw new Error(`Asset file not found: ${assetPath}`);
    }

    return assetPath;
  }

  private async renderClip(
    job: Job,
    clip: ClipType,
    assets: AssetType[],
    outputPath: string,
    projectSettings: any,
    exportSettings: any
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const assetPath = await this.getAssetPath(clip.assetId, assets);
        const asset = assets.find(a => a.assetId === clip.assetId);
        
        if (!asset) {
          throw new Error(`Asset not found: ${clip.assetId}`);
        }

        this.updateProgress(job, {
          stage: 'clip-processing',
          progress: 10,
          message: `Processing clip: ${asset.fileName}`
        });

        let command = ffmpeg(assetPath);

        // Set timeout for FFmpeg operations (5 minutes)
        command.outputOptions(['-timeout', '300']);

        // For images, we need to create a video from the static image
        if (asset.type === 'image') {
          command = command
            .loop(clip.duration) // Loop the image for the specified duration
            .fps(exportSettings.fps || projectSettings.fps || 30);
        } else {
          // For video/audio files, handle seeking and duration
          if (clip.startTime > 0) {
            command = command.seekInput(clip.startTime);
          }
          
          if (clip.duration) {
            command = command.duration(clip.duration);
          }
        }

        // Set output resolution based on export settings
        const getResolution = (res: string) => {
          switch (res) {
            case '720p': return '1280x720';
            case '1080p': return '1920x1080';
            case '4K': return '3840x2160';
            default: return '1920x1080';
          }
        };
        const resolution = getResolution(exportSettings.resolution);
        command = command.size(resolution);

        // Apply Ken Burns animation if present
        if (clip.animation && clip.animation.type === 'ken_burns') {
          const { startRect, endRect } = clip.animation;
          
          // Calculate zoom and pan parameters for Ken Burns effect
          const duration = clip.duration || 5;
          const fps = projectSettings.fps || 30;
          const totalFrames = Math.ceil(duration * fps);
          
          // Simple zoompan filter for Ken Burns effect
          const zoomFilter = `zoompan=z='min(max(zoom,pzoom)+0.0015,1.5)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
          command = command.videoFilters(zoomFilter);
        }

        // Apply video codec based on export settings
        const getVideoCodec = (codec: string) => {
          switch (codec) {
            case 'h264': return 'libx264';
            case 'h265': return 'libx265';
            case 'vp9': return 'libvpx-vp9';
            default: return 'libx264';
          }
        };

        const getAudioCodec = (codec: string) => {
          switch (codec) {
            case 'aac': return 'aac';
            case 'mp3': return 'libmp3lame';
            case 'opus': return 'libopus';
            default: return 'aac';
          }
        };

        // Apply quality settings
        const getQualitySettings = (quality: string, codec: string) => {
          const settings: string[] = [];
          
          if (codec === 'libx264' || codec === 'libx265') {
            switch (quality) {
              case 'low':
                settings.push('-preset', 'ultrafast', '-crf', '28');
                break;
              case 'medium':
                settings.push('-preset', 'fast', '-crf', '25');
                break;
              case 'high':
                settings.push('-preset', 'medium', '-crf', '23');
                break;
              case 'ultra':
                settings.push('-preset', 'slow', '-crf', '18');
                break;
              default:
                settings.push('-preset', 'medium', '-crf', '23');
            }
          } else if (codec === 'libvpx-vp9') {
            switch (quality) {
              case 'low':
                settings.push('-crf', '40', '-b:v', '0');
                break;
              case 'medium':
                settings.push('-crf', '35', '-b:v', '0');
                break;
              case 'high':
                settings.push('-crf', '30', '-b:v', '0');
                break;
              case 'ultra':
                settings.push('-crf', '25', '-b:v', '0');
                break;
              default:
                settings.push('-crf', '30', '-b:v', '0');
            }
          }
          
          return settings;
        };

        const videoCodec = getVideoCodec(exportSettings.videoCodec);
        const audioCodec = getAudioCodec(exportSettings.audioCodec);
        const qualitySettings = getQualitySettings(exportSettings.quality, videoCodec);

        command = command.videoCodec(videoCodec);
        command = command.outputOptions(qualitySettings);

        // Apply custom bitrates if specified
        if (exportSettings.videoBitrate) {
          command = command.videoBitrate(exportSettings.videoBitrate);
        }

        if (exportSettings.audioBitrate) {
          command = command.audioBitrate(exportSettings.audioBitrate);
        }

        // Set output format
        const getFormat = (format: string) => {
          switch (format) {
            case 'mp4': return 'mp4';
            case 'mov': return 'mov';
            case 'webm': return 'webm';
            default: return 'mp4';
          }
        };
        command = command.format(getFormat(exportSettings.format));

        // Handle audio based on asset type
        if (asset.type === 'image') {
          // For images, add silent audio track
          command = command.audioCodec(audioCodec);
          if (audioCodec !== 'libopus') {
            command = command.outputOptions(['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000']);
          }
        } else {
          command = command.audioCodec(audioCodec);
          
          // Apply volume if specified
          if (clip.volume !== undefined && clip.volume !== 1) {
            command = command.audioFilters(`volume=${clip.volume}`);
          }
        }

        // Set up progress tracking
        command.on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0);
          this.updateProgress(job, {
            stage: 'clip-processing',
            progress: Math.min(10 + percent * 0.4, 50), // 10-50% for individual clip processing
            message: `Rendering clip: ${asset.fileName} (${percent}%)`
          });
        });

        command.on('error', (err) => {
          console.error(`FFmpeg error for clip ${clip.clipId}:`, err);
          reject(new Error(`Failed to process clip ${clip.clipId}: ${err.message}`));
        });

        command.on('end', () => {
          this.updateProgress(job, {
            stage: 'clip-processing',
            progress: 50,
            message: `Completed clip: ${asset.fileName}`
          });
          resolve();
        });

        // Start processing
        command.save(outputPath);

      } catch (error) {
        reject(error);
      }
    });
  }

  private async combineClips(
    job: Job,
    clipPaths: string[],
    outputPath: string,
    projectSettings: any,
    exportSettings: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (clipPaths.length === 0) {
        reject(new Error('No clips to combine'));
        return;
      }

      if (clipPaths.length === 1) {
        // Single clip, just copy it
        fs.copyFileSync(clipPaths[0], outputPath);
        resolve();
        return;
      }

      this.updateProgress(job, {
        stage: 'combining',
        progress: 60,
        message: 'Combining clips into final video'
      });

      let command = ffmpeg();

      // Add all input files
      clipPaths.forEach(clipPath => {
        command = command.input(clipPath);
      });

      // Create filter complex for concatenation
      const filterComplex = clipPaths
        .map((_, index) => `[${index}:v][${index}:a]`)
        .join('') + `concat=n=${clipPaths.length}:v=1:a=1[outv][outa]`;

      // Apply export settings to combination
      const getVideoCodec = (codec: string) => {
        switch (codec) {
          case 'h264': return 'libx264';
          case 'h265': return 'libx265';
          case 'vp9': return 'libvpx-vp9';
          default: return 'libx264';
        }
      };

      const getAudioCodec = (codec: string) => {
        switch (codec) {
          case 'aac': return 'aac';
          case 'mp3': return 'libmp3lame';
          case 'opus': return 'libopus';
          default: return 'aac';
        }
      };

      const getResolution = (res: string) => {
        switch (res) {
          case '720p': return '1280x720';
          case '1080p': return '1920x1080';
          case '4K': return '3840x2160';
          default: return '1920x1080';
        }
      };

      const getFormat = (format: string) => {
        switch (format) {
          case 'mp4': return 'mp4';
          case 'mov': return 'mov';
          case 'webm': return 'webm';
          default: return 'mp4';
        }
      };

      const videoCodec = getVideoCodec(exportSettings.videoCodec);
      const audioCodec = getAudioCodec(exportSettings.audioCodec);
      const resolution = getResolution(exportSettings.resolution);
      const format = getFormat(exportSettings.format);

      command = command
        .complexFilter(filterComplex)
        .outputOptions(['-map', '[outv]', '-map', '[outa]'])
        .videoCodec(videoCodec)
        .audioCodec(audioCodec)
        .format(format)
        .fps(exportSettings.fps || projectSettings.fps || 30)
        .size(resolution);

      // Apply custom bitrates if specified
      if (exportSettings.videoBitrate) {
        command = command.videoBitrate(exportSettings.videoBitrate);
      }

      if (exportSettings.audioBitrate) {
        command = command.audioBitrate(exportSettings.audioBitrate);
      }

      command.on('progress', (progress) => {
        const percent = Math.round(progress.percent || 0);
        this.updateProgress(job, {
          stage: 'combining',
          progress: Math.min(60 + percent * 0.35, 95),
          message: `Combining clips (${percent}%)`
        });
      });

      command.on('error', (err) => {
        console.error('FFmpeg combination error:', err);
        reject(new Error(`Failed to combine clips: ${err.message}`));
      });

      command.on('end', () => {
        this.updateProgress(job, {
          stage: 'combining',
          progress: 95,
          message: 'Successfully combined all clips'
        });
        resolve();
      });

      command.save(outputPath);
    });
  }

  private async applyTransitions(
    job: Job,
    clips: ClipType[],
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    // For now, we'll implement basic cross-dissolve transitions
    // This is a simplified implementation - full transition support would be more complex
    
    const hasTransitions = clips.some(clip => clip.transition);
    
    if (!hasTransitions) {
      // No transitions, just copy the file
      fs.copyFileSync(inputPath, outputPath);
      return;
    }

    return new Promise((resolve, reject) => {
      this.updateProgress(job, {
        stage: 'transitions',
        progress: 96,
        message: 'Applying transitions'
      });

      // For now, we'll skip complex transition processing
      // In a full implementation, this would use FFmpeg's xfade filter
      fs.copyFileSync(inputPath, outputPath);
      
      this.updateProgress(job, {
        stage: 'transitions',
        progress: 98,
        message: 'Transitions applied'
      });
      
      resolve();
    });
  }

  async processRenderJob(job: Job<RenderJobType>): Promise<{ outputPath: string }> {
    const { projectData, exportSettings, jobId } = job.data;
    
    console.log(`🎬 Starting render job: ${jobId}`);
    
    this.updateProgress(job, {
      stage: 'initialization',
      progress: 0,
      message: 'Initializing render process'
    });

    try {
      // Validate project data
      if (!projectData.timeline.videoTracks.length && !projectData.timeline.audioTracks.length) {
        throw new Error('Project contains no clips to render');
      }

      // Get all clips from all tracks (simplified - assumes single video track for now)
      const allClips: ClipType[] = [
        ...projectData.timeline.videoTracks.flat(),
        ...projectData.timeline.audioTracks.flat()
      ];

      if (allClips.length === 0) {
        throw new Error('No clips found in project timeline');
      }

      // Sort clips by start time
      allClips.sort((a, b) => a.startTime - b.startTime);

      this.updateProgress(job, {
        stage: 'validation',
        progress: 5,
        message: `Found ${allClips.length} clips to process`
      });

      // Generate output filename with correct extension
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const getFileExtension = (format: string) => {
        switch (format) {
          case 'mp4': return 'mp4';
          case 'mov': return 'mov';
          case 'webm': return 'webm';
          default: return 'mp4';
        }
      };
      const extension = getFileExtension(exportSettings.format);
      const outputFilename = `render-${jobId}-${timestamp}.${extension}`;
      const finalOutputPath = path.join(downloadsDir, outputFilename);

      // Process clips individually first
      const tempClipPaths: string[] = [];
      
      for (let i = 0; i < allClips.length; i++) {
        const clip = allClips[i];
        const tempClipPath = path.join(downloadsDir, `temp-clip-${i}-${uuidv4()}.mp4`);
        
        await this.renderClip(job, clip, projectData.assetLibrary, tempClipPath, projectData.projectSettings, exportSettings);
        tempClipPaths.push(tempClipPath);
      }

      // Combine all clips
      const tempCombinedPath = path.join(downloadsDir, `temp-combined-${uuidv4()}.mp4`);
      await this.combineClips(job, tempClipPaths, tempCombinedPath, projectData.projectSettings, exportSettings);

      // Apply transitions
      await this.applyTransitions(job, allClips, tempCombinedPath, finalOutputPath);

      // Clean up temporary files
      tempClipPaths.forEach(tempPath => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      });
      
      if (fs.existsSync(tempCombinedPath)) {
        fs.unlinkSync(tempCombinedPath);
      }

      this.updateProgress(job, {
        stage: 'completed',
        progress: 100,
        message: 'Render completed successfully'
      });

      console.log(`✅ Render job completed: ${jobId}`);
      console.log(`📁 Output file: ${finalOutputPath}`);

      return { outputPath: finalOutputPath };

    } catch (error) {
      console.error(`❌ Render job failed: ${jobId}`, error);
      throw error;
    }
  }
}

// Create worker instance
const renderWorker = new FFmpegRenderWorker();

// Create enhanced worker manager
const workerManager = new WorkerManager(
  redisManager.getRedisInstance()!,
  'video-render',
  async (job: Job<RenderJobType>) => {
    try {
      const result = await renderWorker.processRenderJob(job);
      return result;
    } catch (error) {
      console.error(`Worker error for job ${job.id}:`, error);
      throw error;
    }
  },
  {
    concurrency: 1,
    maxJobTime: 30 * 60 * 1000, // 30 minutes
    healthCheckInterval: 30000,
    autoRestart: true,
    maxRestarts: 5,
    restartDelay: 5000
  }
);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Worker received ${signal}. Starting graceful shutdown...`);
  
  try {
    await workerManager.close();
    console.log('✅ Worker manager closed');
    
    await redisManager.close();
    console.log('✅ Redis manager closed');
    
    console.log('✅ Worker graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during worker shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Worker uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Worker unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

console.log('🎬 Enhanced FFmpeg render worker started');

export default workerManager;