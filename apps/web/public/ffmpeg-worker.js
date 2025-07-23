// FFmpeg Web Worker for thumbnail generation
let ffmpeg = null;
let isLoaded = false;

// Initialize FFmpeg
async function initFFmpeg() {
  if (isLoaded) return;
  
  try {
    // For now, just simulate FFmpeg initialization
    // In a real implementation, you would load FFmpeg.wasm here
    console.log('FFmpeg worker initialized (simulated)');
    isLoaded = true;
    self.postMessage({ type: 'init-success' });
  } catch (error) {
    console.error('FFmpeg initialization failed:', error);
    self.postMessage({ 
      type: 'init-error', 
      error: error.message 
    });
  }
}

// Generate thumbnail for image (simulated)
async function generateImageThumbnail(file, fileName) {
  try {
    // For now, create a simple canvas-based thumbnail
    const canvas = new OffscreenCanvas(150, 150);
    const ctx = canvas.getContext('2d');
    
    // Create a simple colored rectangle as placeholder
    ctx.fillStyle = '#4A90E2';
    ctx.fillRect(0, 0, 150, 150);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('IMG', 75, 75);
    
    const blob = await canvas.convertToBlob({ type: 'image/jpeg' });
    const thumbnailUrl = URL.createObjectURL(blob);
    
    return thumbnailUrl;
  } catch (error) {
    console.error('Image thumbnail generation failed:', error);
    throw error;
  }
}

// Generate filmstrip for video with multiple frames
async function generateVideoFilmstrip(file, fileName) {
  try {
    // Enhanced configuration for filmstrip generation with better quality
    const FRAME_WIDTH = 160;  // Increased size for better quality and readability
    const FRAME_HEIGHT = 90;  // 16:9 aspect ratio (160/90 ≈ 1.78)
    const FRAME_COUNT = 50;   // More frames for smoother scrubbing and better timeline representation
    const FILMSTRIP_WIDTH = FRAME_WIDTH * FRAME_COUNT;
    
    // Create video element to extract frames
    const video = document.createElement('video');
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    
    // Load video
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    
    return new Promise((resolve, reject) => {
      video.onloadedmetadata = async () => {
        try {
          const duration = video.duration || 10; // Default to 10 seconds if duration unavailable
          
          // Create thumbnail (frame at 10% of video)
          const thumbnailCanvas = new OffscreenCanvas(FRAME_WIDTH, FRAME_HEIGHT);
          const thumbnailCtx = thumbnailCanvas.getContext('2d');
          
          // Create filmstrip canvas with optimized settings
          const filmstripCanvas = new OffscreenCanvas(FILMSTRIP_WIDTH, FRAME_HEIGHT);
          const filmstripCtx = filmstripCanvas.getContext('2d');
          
          // Set high-quality rendering
          filmstripCtx.imageSmoothingEnabled = true;
          filmstripCtx.imageSmoothingQuality = 'high';
          
          // Generate frames sequentially for better reliability
          let framesGenerated = 0;
          const generateFrame = async (frameIndex) => {
            return new Promise((frameResolve) => {
              // Enhanced smart frame distribution for better timeline representation
              let timePercent;
              
              // Use logarithmic distribution for better coverage of important moments
              if (frameIndex < FRAME_COUNT * 0.2) {
                // First 20% of frames cover first 10% of video (opening moments)
                timePercent = (frameIndex / (FRAME_COUNT * 0.2)) * 0.1;
              } else if (frameIndex > FRAME_COUNT * 0.8) {
                // Last 20% of frames cover last 10% of video (ending moments)
                const lastFrameIndex = frameIndex - FRAME_COUNT * 0.8;
                const lastFrameCount = FRAME_COUNT * 0.2;
                timePercent = 0.9 + (lastFrameIndex / lastFrameCount) * 0.1;
              } else {
                // Middle 60% of frames cover middle 80% of video with slight bias toward center
                const middleFrameIndex = frameIndex - FRAME_COUNT * 0.2;
                const middleFrameCount = FRAME_COUNT * 0.6;
                const linearPercent = middleFrameIndex / middleFrameCount;
                
                // Apply slight curve to get more frames around the middle
                const curvedPercent = 0.5 + Math.sin((linearPercent - 0.5) * Math.PI) * 0.4;
                timePercent = 0.1 + curvedPercent * 0.8;
              }
              
              const seekTime = duration * timePercent;
              
              // Use the same video element but seek to different times
              video.currentTime = seekTime;
              
              const onSeeked = () => {
                try {
                  // Draw frame to filmstrip
                  const x = frameIndex * FRAME_WIDTH;
                  filmstripCtx.drawImage(video, x, 0, FRAME_WIDTH, FRAME_HEIGHT);
                  
                  // Generate thumbnail from a meaningful frame (25% position for better content representation)
                  if (frameIndex === Math.floor(FRAME_COUNT * 0.25)) {
                    thumbnailCtx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
                  }
                  
                  framesGenerated++;
                  video.removeEventListener('seeked', onSeeked);
                  frameResolve();
                } catch (error) {
                  console.warn(`Failed to generate frame ${frameIndex}:`, error);
                  // Draw placeholder frame
                  filmstripCtx.fillStyle = '#E74C3C';
                  filmstripCtx.fillRect(frameIndex * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT);
                  filmstripCtx.fillStyle = 'white';
                  filmstripCtx.font = '8px Arial';
                  filmstripCtx.textAlign = 'center';
                  filmstripCtx.fillText(`${Math.round(seekTime)}s`, frameIndex * FRAME_WIDTH + FRAME_WIDTH/2, FRAME_HEIGHT/2);
                  
                  framesGenerated++;
                  video.removeEventListener('seeked', onSeeked);
                  frameResolve();
                }
              };
              
              video.addEventListener('seeked', onSeeked);
              
              // Fallback timeout with better error handling
              setTimeout(() => {
                if (framesGenerated <= frameIndex) {
                  video.removeEventListener('seeked', onSeeked);
                  // Draw enhanced placeholder frame with better visual feedback
                  const gradient = filmstripCtx.createLinearGradient(
                    frameIndex * FRAME_WIDTH, 0, 
                    frameIndex * FRAME_WIDTH + FRAME_WIDTH, FRAME_HEIGHT
                  );
                  gradient.addColorStop(0, '#E74C3C');
                  gradient.addColorStop(1, '#C53030');
                  
                  filmstripCtx.fillStyle = gradient;
                  filmstripCtx.fillRect(frameIndex * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT);
                  
                  // Add frame border
                  filmstripCtx.strokeStyle = '#991B1B';
                  filmstripCtx.lineWidth = 1;
                  filmstripCtx.strokeRect(frameIndex * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT);
                  
                  // Add time indicator
                  filmstripCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                  filmstripCtx.font = 'bold 10px Arial';
                  filmstripCtx.textAlign = 'center';
                  filmstripCtx.fillText(`${Math.round(seekTime)}s`, frameIndex * FRAME_WIDTH + FRAME_WIDTH/2, FRAME_HEIGHT/2);
                  
                  framesGenerated++;
                  frameResolve();
                }
              }, 1500); // Increased timeout for better reliability
            });
          };
          
          // Generate frames sequentially to avoid seeking conflicts
          for (let i = 0; i < FRAME_COUNT; i++) {
            await generateFrame(i);
          }
          
          // Convert canvases to blobs with optimized quality
          const thumbnailBlob = await thumbnailCanvas.convertToBlob({ 
            type: 'image/jpeg', 
            quality: 0.9  // Higher quality for thumbnail
          });
          const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
          
          const filmstripBlob = await filmstripCanvas.convertToBlob({ 
            type: 'image/jpeg', 
            quality: 0.8  // Better quality for filmstrip while keeping size reasonable
          });
          const filmstripUrl = URL.createObjectURL(filmstripBlob);
          
          // Clean up
          URL.revokeObjectURL(videoUrl);
          
          resolve({
            thumbnailUrl,
            filmstripUrl,
            filmstripFrameCount: FRAME_COUNT,
            filmstripFrameWidth: FRAME_WIDTH,
            filmstripFrameHeight: FRAME_HEIGHT,
            duration
          });
          
        } catch (error) {
          console.warn('Failed to generate video frames, using placeholder:', error);
          URL.revokeObjectURL(videoUrl);
          const fallbackResult = await generatePlaceholderFilmstrip(FRAME_WIDTH, FRAME_HEIGHT, FRAME_COUNT, duration || 10);
          resolve(fallbackResult);
        }
      };
      
      video.onerror = async () => {
        console.warn('Video loading failed, using placeholder');
        URL.revokeObjectURL(videoUrl);
        const fallbackResult = await generatePlaceholderFilmstrip(FRAME_WIDTH, FRAME_HEIGHT, FRAME_COUNT, 10);
        resolve(fallbackResult);
      };
      
      // Timeout for metadata loading
      setTimeout(() => {
        if (!video.duration) {
          console.warn('Video metadata loading timeout, using placeholder');
          URL.revokeObjectURL(videoUrl);
          generatePlaceholderFilmstrip(FRAME_WIDTH, FRAME_HEIGHT, FRAME_COUNT, 10).then(resolve);
        }
      }, 15000); // 15 second timeout for better reliability
    });
    
  } catch (error) {
    console.error('Video filmstrip generation failed:', error);
    // Return placeholder filmstrip with consistent dimensions
    return await generatePlaceholderFilmstrip(120, 68, 30, 10);
  }
}

// Generate placeholder filmstrip when video processing fails
async function generatePlaceholderFilmstrip(frameWidth, frameHeight, frameCount, duration) {
  try {
    // Create enhanced thumbnail with better visual design
    const thumbnailCanvas = new OffscreenCanvas(frameWidth, frameHeight);
    const thumbnailCtx = thumbnailCanvas.getContext('2d');
    
    // Enhanced placeholder thumbnail with better gradient
    const gradient = thumbnailCtx.createRadialGradient(
      frameWidth/2, frameHeight/2, 0,
      frameWidth/2, frameHeight/2, Math.max(frameWidth, frameHeight)/2
    );
    gradient.addColorStop(0, '#E74C3C');
    gradient.addColorStop(0.7, '#DC2626');
    gradient.addColorStop(1, '#B91C1C');
    
    thumbnailCtx.fillStyle = gradient;
    thumbnailCtx.fillRect(0, 0, frameWidth, frameHeight);
    
    // Add subtle border
    thumbnailCtx.strokeStyle = '#991B1B';
    thumbnailCtx.lineWidth = 2;
    thumbnailCtx.strokeRect(1, 1, frameWidth - 2, frameHeight - 2);
    
    // Add enhanced video icon
    thumbnailCtx.fillStyle = 'white';
    thumbnailCtx.font = 'bold 12px Arial';
    thumbnailCtx.textAlign = 'center';
    thumbnailCtx.fillText('▶', frameWidth/2, frameHeight/2 - 8);
    thumbnailCtx.font = 'bold 8px Arial';
    thumbnailCtx.fillText('VIDEO', frameWidth/2, frameHeight/2 + 8);
    
    const thumbnailBlob = await thumbnailCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
    
    // Create enhanced filmstrip
    const filmstripCanvas = new OffscreenCanvas(frameWidth * frameCount, frameHeight);
    const filmstripCtx = filmstripCanvas.getContext('2d');
    
    // Set high-quality rendering
    filmstripCtx.imageSmoothingEnabled = true;
    filmstripCtx.imageSmoothingQuality = 'high';
    
    for (let i = 0; i < frameCount; i++) {
      const x = i * frameWidth;
      const timePercent = i / (frameCount - 1);
      const timeSeconds = Math.round(duration * timePercent * 10) / 10; // One decimal place
      
      // Frame background with gradient
      const frameGradient = filmstripCtx.createLinearGradient(x, 0, x + frameWidth, frameHeight);
      frameGradient.addColorStop(0, '#E74C3C');
      frameGradient.addColorStop(0.5, '#DC2626');
      frameGradient.addColorStop(1, '#B91C1C');
      
      filmstripCtx.fillStyle = frameGradient;
      filmstripCtx.fillRect(x, 0, frameWidth, frameHeight);
      
      // Frame border
      filmstripCtx.strokeStyle = '#991B1B';
      filmstripCtx.lineWidth = 0.5;
      filmstripCtx.strokeRect(x, 0, frameWidth, frameHeight);
      
      // Time indicator with better visibility
      filmstripCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      filmstripCtx.fillRect(x + 2, frameHeight - 12, frameWidth - 4, 10);
      
      filmstripCtx.fillStyle = 'white';
      filmstripCtx.font = '7px Arial';
      filmstripCtx.textAlign = 'center';
      filmstripCtx.fillText(`${timeSeconds}s`, x + frameWidth/2, frameHeight - 4);
      
      // Add subtle frame separator
      if (i > 0) {
        filmstripCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        filmstripCtx.lineWidth = 1;
        filmstripCtx.beginPath();
        filmstripCtx.moveTo(x, 0);
        filmstripCtx.lineTo(x, frameHeight);
        filmstripCtx.stroke();
      }
    }
    
    const filmstripBlob = await filmstripCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
    const filmstripUrl = URL.createObjectURL(filmstripBlob);
    
    return {
      thumbnailUrl,
      filmstripUrl,
      filmstripFrameCount: frameCount,
      filmstripFrameWidth: frameWidth,
      filmstripFrameHeight: frameHeight,
      duration
    };
  } catch (error) {
    console.error('Placeholder filmstrip generation failed:', error);
    throw error;
  }
}

// Generate thumbnail for audio (simulated waveform)
async function generateAudioThumbnail(file, fileName) {
  try {
    const canvas = new OffscreenCanvas(300, 150);
    const ctx = canvas.getContext('2d');
    
    // Create a simple waveform visualization
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 300, 150);
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Draw a simple sine wave
    for (let x = 0; x < 300; x++) {
      const y = 75 + Math.sin(x * 0.1) * 30 * Math.random();
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const thumbnailUrl = URL.createObjectURL(blob);
    
    return thumbnailUrl;
  } catch (error) {
    console.error('Audio thumbnail generation failed:', error);
    throw error;
  }
}

// Get media duration (simulated)
async function getMediaDuration(file, fileName) {
  try {
    // Return default durations based on file type
    if (fileName.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      return 10; // Default 10 seconds for video
    } else if (fileName.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      return 30; // Default 30 seconds for audio
    }
    return 5; // Default 5 seconds for images
  } catch (error) {
    console.error('Duration detection failed:', error);
    return 5;
  }
}

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, file, fileName, assetType, assetId } = e.data;
  
  try {
    switch (type) {
      case 'init':
        await initFFmpeg();
        break;
        
      case 'generate-thumbnail':
        if (!isLoaded) {
          await initFFmpeg();
        }
        
        let result = {};
        
        // Get duration for all asset types
        const duration = await getMediaDuration(file, fileName);
        result.duration = duration;
        
        // Generate appropriate thumbnail based on asset type
        switch (assetType) {
          case 'image':
            result.thumbnailUrl = await generateImageThumbnail(file, fileName);
            break;
            
          case 'video':
            const videoResult = await generateVideoFilmstrip(file, fileName);
            result.thumbnailUrl = videoResult.thumbnailUrl;
            result.filmstripUrl = videoResult.filmstripUrl;
            result.filmstripFrameCount = videoResult.filmstripFrameCount;
            result.filmstripFrameWidth = videoResult.filmstripFrameWidth;
            result.duration = videoResult.duration;
            break;
            
          case 'audio':
            result.thumbnailUrl = await generateAudioThumbnail(file, fileName);
            break;
            
          default:
            throw new Error(`Unsupported asset type: ${assetType}`);
        }
        
        self.postMessage({
          type: 'thumbnail-success',
          assetId,
          result
        });
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'thumbnail-error',
      assetId,
      error: error.message
    });
  }
};