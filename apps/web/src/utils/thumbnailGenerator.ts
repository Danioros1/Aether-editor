// Thumbnail generation utility using FFmpeg Web Worker

export interface ThumbnailResult {
  thumbnailUrl: string;
  filmstripUrl?: string; // For videos - tiled filmstrip image
  filmstripFrameCount?: number; // Number of frames in filmstrip
  filmstripFrameWidth?: number; // Width of each frame in filmstrip
  filmstripFrameHeight?: number; // Height of each frame in filmstrip
  duration: number;
}

export interface ThumbnailGenerationOptions {
  assetId: string;
  file: File;
  assetType: 'image' | 'video' | 'audio';
}

class ThumbnailGenerator {
  private worker: Worker | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private pendingRequests = new Map<string, {
    resolve: (result: ThumbnailResult) => void;
    reject: (error: Error) => void;
  }>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      // Create worker from public directory
      this.worker = new Worker('/ffmpeg-worker.js', { type: 'module' });
      
      this.worker.onmessage = (e) => {
        const { type, assetId, result, error } = e.data;
        
        switch (type) {
          case 'init-success':
            this.isInitialized = true;
            break;
            
          case 'init-error':
            console.error('FFmpeg worker initialization failed:', error);
            this.isInitialized = false;
            break;
            
          case 'thumbnail-success':
            const successRequest = this.pendingRequests.get(assetId);
            if (successRequest) {
              successRequest.resolve(result);
              this.pendingRequests.delete(assetId);
            }
            break;
            
          case 'thumbnail-error':
            const errorRequest = this.pendingRequests.get(assetId);
            if (errorRequest) {
              errorRequest.reject(new Error(error));
              this.pendingRequests.delete(assetId);
            }
            break;
        }
      };
      
      this.worker.onerror = (error) => {
        console.error('FFmpeg worker error:', error);
        this.isInitialized = false;
      };
      
      // Initialize FFmpeg
      this.initPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('FFmpeg initialization timeout'));
        }, 30000); // 30 second timeout
        
        const checkInit = () => {
          if (this.isInitialized) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkInit, 100);
          }
        };
        
        this.worker?.postMessage({ type: 'init' });
        checkInit();
      });
      
    } catch (error) {
      console.error('Failed to create FFmpeg worker:', error);
      this.worker = null;
    }
  }

  async generateThumbnail(options: ThumbnailGenerationOptions): Promise<ThumbnailResult> {
    if (!this.worker) {
      throw new Error('FFmpeg worker not available');
    }

    // Wait for initialization if needed
    if (!this.isInitialized && this.initPromise) {
      try {
        await this.initPromise;
      } catch (error) {
        throw new Error(`FFmpeg initialization failed: ${error}`);
      }
    }

    if (!this.isInitialized) {
      throw new Error('FFmpeg worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const { assetId, file, assetType } = options;
      
      // Store the promise resolvers
      this.pendingRequests.set(assetId, { resolve, reject });
      
      // Set a timeout for the request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(assetId);
        reject(new Error('Thumbnail generation timeout'));
      }, 60000); // 60 second timeout
      
      // Clear timeout when request completes
      const originalResolve = resolve;
      const originalReject = reject;
      
      const wrappedResolve = (result: ThumbnailResult) => {
        clearTimeout(timeout);
        originalResolve(result);
      };
      
      const wrappedReject = (error: Error) => {
        clearTimeout(timeout);
        originalReject(error);
      };
      
      this.pendingRequests.set(assetId, { 
        resolve: wrappedResolve, 
        reject: wrappedReject 
      });
      
      // Send generation request to worker
      this.worker!.postMessage({
        type: 'generate-thumbnail',
        assetId,
        file,
        fileName: file.name,
        assetType
      });
    });
  }

  // Generate fallback thumbnail for when FFmpeg is not available
  generateFallbackThumbnail(file: File, assetType: 'image' | 'video' | 'audio'): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
      if (assetType === 'image') {
        // For images, create object URL as thumbnail
        const thumbnailUrl = URL.createObjectURL(file);
        resolve({
          thumbnailUrl,
          duration: 5 // Default 5 seconds for images
        });
      } else {
        // For video/audio, use a placeholder
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d')!;
        
        // Draw placeholder
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, 150, 150);
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(assetType.toUpperCase(), 75, 75);
        
        canvas.toBlob((blob) => {
          const thumbnailUrl = URL.createObjectURL(blob!);
          resolve({
            thumbnailUrl,
            duration: assetType === 'video' ? 10 : 30
          });
        });
      }
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
    this.isInitialized = false;
    this.initPromise = null;
  }
}

// Create singleton instance
export const thumbnailGenerator = new ThumbnailGenerator();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    thumbnailGenerator.destroy();
  });
}