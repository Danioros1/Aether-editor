import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { useSelectedClipId, useAssetLibrary, useCurrentTime, useTimeline, useIsPlaying } from '../store/useAetherStore';
import { AssetType, ClipType } from '@aether-editor/types';
import { performanceMonitor } from '../utils/performanceMonitor';
import { useMemoryTracking, useAutoMemoryCleanup } from '../hooks/useMemoryManager';

interface OptimizedPreviewWindowProps {
  width?: number;
  height?: number;
}

// Texture pool for better memory management
class TexturePool {
  private pool = new Map<string, PIXI.Texture>();
  private maxSize = 20; // Limit texture pool size
  private accessTimes = new Map<string, number>();

  get(key: string): PIXI.Texture | null {
    const texture = this.pool.get(key);
    if (texture) {
      this.accessTimes.set(key, Date.now());
      return texture;
    }
    return null;
  }

  set(key: string, texture: PIXI.Texture): void {
    // Clean up if pool is full
    if (this.pool.size >= this.maxSize) {
      this.cleanup();
    }

    this.pool.set(key, texture);
    this.accessTimes.set(key, Date.now());
  }

  private cleanup(): void {
    // Remove least recently used textures
    const entries = Array.from(this.accessTimes.entries());
    entries.sort((a, b) => a[1] - b[1]); // Sort by access time
    
    const toRemove = entries.slice(0, Math.floor(this.maxSize * 0.3)); // Remove 30%
    
    toRemove.forEach(([key]) => {
      const texture = this.pool.get(key);
      if (texture) {
        texture.destroy(true);
        this.pool.delete(key);
        this.accessTimes.delete(key);
      }
    });
  }

  clear(): void {
    this.pool.forEach(texture => texture.destroy(true));
    this.pool.clear();
    this.accessTimes.clear();
  }

  getStats() {
    return {
      size: this.pool.size,
      maxSize: this.maxSize
    };
  }
}

// Sprite pool for object reuse
class SpritePool {
  private pool: PIXI.Sprite[] = [];
  private maxSize = 10;

  get(): PIXI.Sprite {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return new PIXI.Sprite();
  }

  release(sprite: PIXI.Sprite): void {
    if (this.pool.length < this.maxSize) {
      // Reset sprite properties
      sprite.texture = PIXI.Texture.EMPTY;
      sprite.alpha = 1;
      sprite.scale.set(1);
      sprite.anchor.set(0);
      sprite.position.set(0);
      sprite.rotation = 0;
      sprite.visible = true;
      
      this.pool.push(sprite);
    } else {
      sprite.destroy();
    }
  }

  clear(): void {
    this.pool.forEach(sprite => sprite.destroy());
    this.pool = [];
  }
}

export const OptimizedPreviewWindow: React.FC<OptimizedPreviewWindowProps> = ({ 
  width = 800, 
  height = 450 
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Subscribe to store state
  const selectedClipId = useSelectedClipId();
  const assetLibrary = useAssetLibrary();
  const currentTime = useCurrentTime();
  const timeline = useTimeline();
  const isPlaying = useIsPlaying();
  
  // Optimized resource management
  const texturePoolRef = useRef(new TexturePool());
  const spritePoolRef = useRef(new SpritePool());
  const currentSpritesRef = useRef<PIXI.Sprite[]>([]);
  const tickerFunctionRef = useRef<(() => void) | null>(null);
  
  // Memory tracking
  const { trackSize, touch } = useMemoryTracking('textures', 'preview-window');
  
  // Performance state
  const [performanceMode, setPerformanceMode] = useState<'normal' | 'optimized' | 'minimal'>('normal');
  const [renderStats] = useState({ 
    frameCount: 0, 
    lastRenderTime: 0,
    skipCount: 0,
    texturePoolHits: 0,
    texturePoolMisses: 0
  });

  // Loading states for better UX
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set());
  const [errorAssets, setErrorAssets] = useState<Set<string>>(new Set());

  // Memoized asset lookup
  const assetMap = useMemo(() => {
    const map = new Map<string, AssetType>();
    assetLibrary.forEach(asset => map.set(asset.assetId, asset));
    return map;
  }, [assetLibrary]);

  // Helper function to find asset by ID
  const findAssetById = useCallback((assetId: string): AssetType | undefined => {
    return assetMap.get(assetId);
  }, [assetMap]);

  // Optimized active clip detection
  const activeClipInfo = useMemo(() => {
    // Check all video tracks for clips that are active at the current time
    for (let trackIndex = 0; trackIndex < timeline.videoTracks.length; trackIndex++) {
      const track = timeline.videoTracks[trackIndex];
      for (const clip of track) {
        const clipEndTime = clip.startTime + clip.duration;
        if (currentTime >= clip.startTime && currentTime < clipEndTime) {
          return {
            clip,
            trackIndex,
            relativeTime: currentTime - clip.startTime
          };
        }
      }
    }
    return null;
  }, [timeline.videoTracks, currentTime]);

  // Optimized transition detection
  const transitionInfo = useMemo(() => {
    for (const track of timeline.videoTracks) {
      for (let i = 0; i < track.length; i++) {
        const currentClip = track[i];
        const nextClip = i + 1 < track.length ? track[i + 1] : null;
        
        if (currentClip.transition && nextClip) {
          const transitionStartTime = currentClip.startTime + currentClip.duration - currentClip.transition.duration;
          const transitionEndTime = currentClip.startTime + currentClip.duration;
          
          if (currentTime >= transitionStartTime && currentTime <= transitionEndTime) {
            const transitionProgress = (currentTime - transitionStartTime) / currentClip.transition.duration;
            return {
              outgoingClip: currentClip,
              incomingClip: nextClip,
              transitionProgress: Math.max(0, Math.min(1, transitionProgress))
            };
          }
        }
      }
    }
    
    return null;
  }, [timeline.videoTracks, currentTime]);

  // Memory cleanup callback
  const cleanupCallback = useCallback(async (): Promise<number> => {
    let freedMemory = 0;
    
    // Clear texture pool
    const textureStats = texturePoolRef.current.getStats();
    texturePoolRef.current.clear();
    freedMemory += textureStats.size * 2; // Estimate 2MB per texture
    
    // Clear sprite pool
    spritePoolRef.current.clear();
    
    // Clear current sprites
    currentSpritesRef.current.forEach(sprite => sprite.destroy());
    currentSpritesRef.current = [];
    
    console.log(`OptimizedPreviewWindow: Freed approximately ${freedMemory}MB`);
    return freedMemory;
  }, []);

  // Register automatic memory cleanup
  useAutoMemoryCleanup('textures', cleanupCallback);

  // Performance monitoring setup
  useEffect(() => {
    const handlePerformanceOptimization = (event: CustomEvent) => {
      const { severity } = event.detail;
      
      if (severity === 'critical') {
        setPerformanceMode('minimal');
        console.log('OptimizedPreviewWindow: Switching to minimal performance mode');
      } else if (severity === 'warning') {
        setPerformanceMode('optimized');
        console.log('OptimizedPreviewWindow: Switching to optimized performance mode');
      }
    };

    const handleMemoryCleanup = (event: CustomEvent) => {
      const { severity } = event.detail;
      
      if (severity === 'critical') {
        cleanupCallback();
      }
    };

    window.addEventListener('performance:optimizeRendering', handlePerformanceOptimization as EventListener);
    window.addEventListener('performance:memoryCleanup', handleMemoryCleanup as EventListener);
    
    return () => {
      window.removeEventListener('performance:optimizeRendering', handlePerformanceOptimization as EventListener);
      window.removeEventListener('performance:memoryCleanup', handleMemoryCleanup as EventListener);
    };
  }, [cleanupCallback]);

  // Initialize PixiJS Application with optimizations
  useEffect(() => {
    if (!canvasRef.current || isInitialized) return;

    const initPixi = () => {
      try {
        // Create PIXI Application with performance optimizations
        const app = new PIXI.Application({
          width,
          height,
          backgroundColor: 0x000000,
          antialias: performanceMode === 'minimal' ? false : true,
          resolution: performanceMode === 'minimal' ? 1 : (window.devicePixelRatio || 1),
          autoDensity: true,
          powerPreference: 'high-performance',
          sharedTicker: true,
        });

        // Performance optimizations
        app.renderer.plugins.interaction.autoPreventDefault = false;
        app.renderer.plugins.interaction.interactionFrequency = performanceMode === 'minimal' ? 30 : 60;

        // Mount the canvas to the DOM
        if (canvasRef.current) {
          canvasRef.current.appendChild(app.view as HTMLCanvasElement);
        }

        // Store the app reference
        appRef.current = app;

        setIsInitialized(true);
        console.log('Optimized PixiJS Preview Window initialized successfully');
        
      } catch (error) {
        console.error('Failed to initialize PixiJS:', error);
      }
    };

    initPixi();

    // Cleanup function
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, true);
        appRef.current = null;
        setIsInitialized(false);
      }
      
      // Clean up pools
      texturePoolRef.current.clear();
      spritePoolRef.current.clear();
    };
  }, [width, height, isInitialized, performanceMode]);

  // Handle canvas resize
  useEffect(() => {
    if (appRef.current && isInitialized) {
      appRef.current.renderer.resize(width, height);
    }
  }, [width, height, isInitialized]);

  // Optimized texture loading with pooling
  const loadTexture = useCallback(async (asset: AssetType): Promise<PIXI.Texture | null> => {
    if (!asset.sourceUrl) return null;

    // Check texture pool first
    const pooledTexture = texturePoolRef.current.get(asset.assetId);
    if (pooledTexture) {
      renderStats.texturePoolHits++;
      return pooledTexture;
    }

    renderStats.texturePoolMisses++;

    // Check if this asset is already in error state
    if (errorAssets.has(asset.assetId)) {
      return null;
    }

    // Mark as loading
    setLoadingAssets(prev => new Set(prev).add(asset.assetId));

    try {
      const texture = await PIXI.Texture.fromURL(asset.sourceUrl);
      
      // Add to texture pool
      texturePoolRef.current.set(asset.assetId, texture);
      
      // Track memory usage
      const textureSize = texture.width * texture.height * 4; // RGBA bytes
      trackSize(textureSize, 2); // High priority for textures
      touch(); // Mark as recently accessed
      
      // Remove from loading and error states
      setLoadingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(asset.assetId);
        return newSet;
      });
      setErrorAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(asset.assetId);
        return newSet;
      });
      
      return texture;
    } catch (error) {
      console.error(`Failed to load texture for asset ${asset.assetId}:`, error);
      
      // Mark as error and remove from loading
      setErrorAssets(prev => new Set(prev).add(asset.assetId));
      setLoadingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(asset.assetId);
        return newSet;
      });
      
      return null;
    }
  }, [errorAssets, renderStats]);

  // Optimized Ken Burns animation
  const applyKenBurnsAnimation = useCallback((sprite: PIXI.Sprite, clip: ClipType, relativeTime: number) => {
    if (!clip.animation || clip.animation.type !== 'ken_burns') {
      return;
    }

    const { startRect, endRect } = clip.animation;
    const clampedTime = Math.max(0, Math.min(relativeTime, clip.duration));
    const progress = clip.duration > 0 ? clampedTime / clip.duration : 0;

    // Optimized interpolation
    const currentScale = startRect.scale + (endRect.scale - startRect.scale) * progress;
    const currentX = startRect.x + (endRect.x - startRect.x) * progress;
    const currentY = startRect.y + (endRect.y - startRect.y) * progress;

    const baseScale = sprite.scale.x;
    sprite.scale.set(baseScale * currentScale);
    sprite.x = width / 2 + currentX;
    sprite.y = height / 2 + currentY;
  }, [width, height]);

  // Optimized text overlay rendering
  const renderTextOverlays = useCallback((app: PIXI.Application, clip: ClipType, relativeTime: number) => {
    if (!clip.textOverlays || clip.textOverlays.length === 0 || performanceMode === 'minimal') {
      return;
    }

    const visibleOverlays = clip.textOverlays.filter(overlay => {
      const overlayEndTime = overlay.startTime + overlay.duration;
      return relativeTime >= overlay.startTime && relativeTime < overlayEndTime;
    });

    visibleOverlays.forEach((overlay) => {
      const overlayRelativeTime = relativeTime - overlay.startTime;
      
      // Simplified text style for performance
      const textStyle = new PIXI.TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: performanceMode === 'optimized' ? 28 : 32,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: performanceMode === 'optimized' ? 1 : 2,
        dropShadow: performanceMode === 'normal',
        dropShadowColor: 0x000000,
        dropShadowBlur: performanceMode === 'optimized' ? 2 : 4,
        dropShadowAngle: Math.PI / 6,
        dropShadowDistance: 2,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: width * 0.8,
      });

      const textObject = new PIXI.Text(overlay.text, textStyle);
      textObject.anchor.set(0.5);
      textObject.x = width / 2 + overlay.position.x;
      textObject.y = height / 2 + overlay.position.y;

      // Simplified fade animation
      const fadeInDuration = 0.3;
      const fadeOutDuration = 0.3;
      
      if (overlayRelativeTime < fadeInDuration) {
        textObject.alpha = overlayRelativeTime / fadeInDuration;
      } else if (overlayRelativeTime > overlay.duration - fadeOutDuration) {
        const fadeOutTime = overlayRelativeTime - (overlay.duration - fadeOutDuration);
        textObject.alpha = 1 - (fadeOutTime / fadeOutDuration);
      } else {
        textObject.alpha = 1;
      }

      textObject.alpha = Math.max(0, Math.min(1, textObject.alpha));

      // Skip scale animation in performance modes
      if (performanceMode === 'normal') {
        const overlayProgress = overlay.duration > 0 ? overlayRelativeTime / overlay.duration : 0;
        const scaleAnimation = 1 + Math.sin(overlayProgress * Math.PI * 2) * 0.02;
        textObject.scale.set(scaleAnimation);
      }

      app.stage.addChild(textObject);
    });
  }, [width, height, performanceMode]);

  // Optimized sprite creation with pooling
  const createSpriteFromAsset = useCallback(async (asset: AssetType, clip: ClipType, relativeTime: number): Promise<PIXI.Sprite | null> => {
    if (asset.type === 'audio') {
      return null;
    }

    const texture = await loadTexture(asset);
    if (!texture) {
      return null;
    }

    // Get sprite from pool
    const sprite = spritePoolRef.current.get();
    sprite.texture = texture;
    
    // Optimized scaling calculation
    const scaleX = width / texture.width;
    const scaleY = height / texture.height;
    const scale = Math.min(scaleX, scaleY);
    
    sprite.scale.set(scale);
    sprite.anchor.set(0.5);
    sprite.x = width / 2;
    sprite.y = height / 2;

    // Apply Ken Burns animation
    applyKenBurnsAnimation(sprite, clip, relativeTime);

    return sprite;
  }, [width, height, loadTexture, applyKenBurnsAnimation]);

  // Optimized frame rendering with performance monitoring
  const renderCurrentFrame = useCallback(async () => {
    if (!appRef.current || !isInitialized) return;

    const startTime = performance.now();
    const app = appRef.current;
    
    // Clear the stage and return sprites to pool
    currentSpritesRef.current.forEach(sprite => {
      app.stage.removeChild(sprite);
      spritePoolRef.current.release(sprite);
    });
    currentSpritesRef.current = [];
    
    // Clear text objects (they're not pooled)
    app.stage.children.forEach(child => {
      if (child instanceof PIXI.Text) {
        app.stage.removeChild(child);
        child.destroy();
      }
    });

    // Handle transitions
    if (transitionInfo) {
      const { outgoingClip, incomingClip, transitionProgress } = transitionInfo;
      const outgoingAsset = findAssetById(outgoingClip.assetId);
      const incomingAsset = findAssetById(incomingClip.assetId);
      
      if (outgoingAsset && incomingAsset) {
        // Handle loading states
        const outgoingLoading = loadingAssets.has(outgoingAsset.assetId);
        const incomingLoading = loadingAssets.has(incomingAsset.assetId);
        const outgoingError = errorAssets.has(outgoingAsset.assetId);
        const incomingError = errorAssets.has(incomingAsset.assetId);
        
        if (outgoingLoading || incomingLoading) {
          const style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 18,
            fill: 0x4A90E2,
            align: 'center',
          });

          const text = new PIXI.Text('Loading transition assets...', style);
          text.anchor.set(0.5);
          text.x = width / 2;
          text.y = height / 2;
          
          app.stage.addChild(text);
          renderStats.lastRenderTime = performance.now() - startTime;
          return;
        }
        
        if (outgoingError || incomingError) {
          const style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 18,
            fill: 0xff6b6b,
            align: 'center',
          });

          const text = new PIXI.Text('Error loading transition assets', style);
          text.anchor.set(0.5);
          text.x = width / 2;
          text.y = height / 2;
          
          app.stage.addChild(text);
          renderStats.lastRenderTime = performance.now() - startTime;
          return;
        }

        // Create sprites for transition
        const outgoingRelativeTime = currentTime - outgoingClip.startTime;
        const incomingRelativeTime = currentTime - incomingClip.startTime;
        
        const outgoingSprite = await createSpriteFromAsset(outgoingAsset, outgoingClip, outgoingRelativeTime);
        const incomingSprite = await createSpriteFromAsset(incomingAsset, incomingClip, incomingRelativeTime);
        
        if (outgoingSprite) {
          outgoingSprite.alpha = 1 - transitionProgress;
          app.stage.addChild(outgoingSprite);
          currentSpritesRef.current.push(outgoingSprite);
          
          renderTextOverlays(app, outgoingClip, outgoingRelativeTime);
        }
        
        if (incomingSprite) {
          incomingSprite.alpha = transitionProgress;
          app.stage.addChild(incomingSprite);
          currentSpritesRef.current.push(incomingSprite);
          
          renderTextOverlays(app, incomingClip, incomingRelativeTime);
        }
        
        // Add selection highlight
        const selectedClip = selectedClipId === outgoingClip.clipId ? outgoingClip :
                            selectedClipId === incomingClip.clipId ? incomingClip : null;
        
        if (selectedClip) {
          const border = new PIXI.Graphics();
          border.lineStyle(4, 0x4A90E2, 1);
          border.drawRect(-2, -2, width + 4, height + 4);
          app.stage.addChild(border);
        }
        
        renderStats.lastRenderTime = performance.now() - startTime;
        return;
      }
    }

    // Handle single active clip
    if (!activeClipInfo) {
      const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0x666666,
        align: 'center',
      });

      const text = new PIXI.Text('No clip at current time', style);
      text.anchor.set(0.5);
      text.x = width / 2;
      text.y = height / 2;
      
      app.stage.addChild(text);
      renderStats.lastRenderTime = performance.now() - startTime;
      return;
    }

    const { clip, relativeTime } = activeClipInfo;
    const asset = findAssetById(clip.assetId);
    
    if (!asset) {
      const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xff6b6b,
        align: 'center',
      });

      const text = new PIXI.Text(`Asset not found: ${clip.assetId}`, style);
      text.anchor.set(0.5);
      text.x = width / 2;
      text.y = height / 2;
      
      app.stage.addChild(text);
      renderStats.lastRenderTime = performance.now() - startTime;
      return;
    }

    // Handle loading state
    if (loadingAssets.has(asset.assetId)) {
      const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0x4A90E2,
        align: 'center',
      });

      const text = new PIXI.Text(`Loading: ${asset.fileName}`, style);
      text.anchor.set(0.5);
      text.x = width / 2;
      text.y = height / 2;
      
      app.stage.addChild(text);
      renderStats.lastRenderTime = performance.now() - startTime;
      return;
    }

    // Handle error state
    if (errorAssets.has(asset.assetId)) {
      const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xff6b6b,
        align: 'center',
      });

      const text = new PIXI.Text(`Error loading: ${asset.fileName}`, style);
      text.anchor.set(0.5);
      text.x = width / 2;
      text.y = height / 2;
      
      app.stage.addChild(text);
      renderStats.lastRenderTime = performance.now() - startTime;
      return;
    }

    // Handle audio assets
    if (asset.type === 'audio') {
      const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0x4A90E2,
        align: 'center',
      });

      const text = new PIXI.Text(`Audio: ${asset.fileName}`, style);
      text.anchor.set(0.5);
      text.x = width / 2;
      text.y = height / 2;
      
      app.stage.addChild(text);
      renderStats.lastRenderTime = performance.now() - startTime;
      return;
    }

    // Create sprite for the active clip
    const sprite = await createSpriteFromAsset(asset, clip, relativeTime);
    
    if (!sprite) {
      const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xff6b6b,
        align: 'center',
      });

      const text = new PIXI.Text(`Failed to load: ${asset.fileName}`, style);
      text.anchor.set(0.5);
      text.x = width / 2;
      text.y = height / 2;
      
      app.stage.addChild(text);
      renderStats.lastRenderTime = performance.now() - startTime;
      return;
    }

    // Add selection highlight if this clip is selected
    if (selectedClipId === clip.clipId) {
      const border = new PIXI.Graphics();
      border.lineStyle(4, 0x4A90E2, 1);
      border.drawRect(-2, -2, width + 4, height + 4);
      app.stage.addChild(border);
    }

    app.stage.addChild(sprite);
    currentSpritesRef.current.push(sprite);

    // Render text overlays
    renderTextOverlays(app, clip, relativeTime);

    renderStats.frameCount++;
    renderStats.lastRenderTime = performance.now() - startTime;

  }, [
    isInitialized, 
    activeClipInfo, 
    transitionInfo, 
    selectedClipId, 
    width, 
    height, 
    findAssetById, 
    createSpriteFromAsset, 
    renderTextOverlays, 
    loadingAssets, 
    errorAssets, 
    currentTime,
    renderStats
  ]);

  // Initial render when state changes (for non-playback scenarios)
  useEffect(() => {
    if (!isPlaying && isInitialized) {
      performanceMonitor.measureAsyncComponentRender('previewRenderTime', renderCurrentFrame);
    }
  }, [currentTime, selectedClipId, assetLibrary.length, isPlaying, isInitialized, renderCurrentFrame]);

  // Optimized ticker for continuous rendering during playback
  useEffect(() => {
    if (!appRef.current || !isInitialized) return;

    const app = appRef.current;
    
    const renderTicker = () => {
      if (isPlaying) {
        performanceMonitor.measureComponentRender('previewRenderTime', () => {
          renderCurrentFrame();
        });
      }
    };

    tickerFunctionRef.current = renderTicker;
    app.ticker.add(renderTicker);

    return () => {
      if (app.ticker && tickerFunctionRef.current) {
        app.ticker.remove(tickerFunctionRef.current);
        tickerFunctionRef.current = null;
      }
    };
  }, [isInitialized, isPlaying, renderCurrentFrame]);

  // Error recovery mechanism
  useEffect(() => {
    if (errorAssets.size === 0) return;

    const retryTimer = setTimeout(() => {
      setErrorAssets(new Set());
      console.log('Retrying failed asset loads...');
    }, 5000);

    return () => clearTimeout(retryTimer);
  }, [errorAssets.size]);

  return (
    <div className="w-full h-full flex flex-col">
      <div 
        className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden"
        role="img"
        aria-label="Optimized video preview window"
        aria-describedby="optimized-preview-instructions"
      >
        <div 
          ref={canvasRef} 
          className="relative"
          style={{ 
            width: `${width}px`, 
            height: `${height}px`,
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
      </div>
      
      {/* Screen reader instructions */}
      <div id="optimized-preview-instructions" className="sr-only">
        Optimized video preview window showing the current frame at {currentTime.toFixed(2)} seconds. 
        {isPlaying ? 'Video is currently playing.' : 'Video is paused.'} 
        {selectedClipId ? `Selected clip: ${selectedClipId.slice(0, 8)}` : 'No clip selected.'}
        This is the performance-optimized version with enhanced rendering capabilities.
        Use timeline controls to navigate and play/pause the video.
      </div>
      
      {/* Enhanced debug info with performance stats */}
      <div className="mt-2 text-xs text-muted-foreground space-y-1">
        <div>
          Status: {isInitialized ? 'Initialized' : 'Loading...'}
          {selectedClipId && ` | Selected: ${selectedClipId.slice(0, 8)}...`}
          {` | Time: ${currentTime.toFixed(2)}s`}
          {isPlaying && ' | Playing'}
          {` | Mode: ${performanceMode}`}
        </div>
        <div>
          Frames: {renderStats.frameCount} | Skipped: {renderStats.skipCount} | 
          Last render: {renderStats.lastRenderTime.toFixed(2)}ms |
          Texture Pool: {texturePoolRef.current.getStats().size}/{texturePoolRef.current.getStats().maxSize} |
          Pool Hits: {renderStats.texturePoolHits} | Misses: {renderStats.texturePoolMisses} |
          Loading: {loadingAssets.size} | Errors: {errorAssets.size}
        </div>
      </div>
    </div>
  );
};