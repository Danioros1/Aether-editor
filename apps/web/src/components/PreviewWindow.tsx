import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useSelectedClipId, useAssetLibrary, useCurrentTime, useTimeline, useIsPlaying } from '../store/useAetherStore';
import { AssetType, ClipType } from '@aether-editor/types';

import { useToast } from '../hooks/use-toast';

interface PreviewWindowProps {
  width?: number;
  height?: number;
}

export const PreviewWindow: React.FC<PreviewWindowProps> = ({ 
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
  
  // Track loaded textures and sprites to avoid reloading
  const loadedTexturesRef = useRef<Map<string, PIXI.Texture>>(new Map());
  const currentSpriteRef = useRef<PIXI.Sprite | null>(null);
  const tickerFunctionRef = useRef<(() => void) | null>(null);
  
  // Loading states for better UX
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set());
  const [errorAssets, setErrorAssets] = useState<Set<string>>(new Set());
  const [_previewError, setPreviewError] = useState<string | null>(null);
  const [_isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [renderStats] = useState({ 
    frameCount: 0, 
    lastRenderTime: 0,
    skipCount: 0 
  });
  const { toast } = useToast();

  // Helper function to find asset by ID
  const findAssetById = useCallback((assetId: string): AssetType | undefined => {
    return assetLibrary.find(asset => asset.assetId === assetId);
  }, [assetLibrary]);

  // Helper function to find active clip at current time
  const findActiveClipAtTime = useCallback((time: number): ClipType | null => {
    // Check all video tracks for clips that are active at the current time
    for (const track of timeline.videoTracks) {
      for (const clip of track) {
        const clipEndTime = clip.startTime + clip.duration;
        if (time >= clip.startTime && time < clipEndTime) {
          return clip;
        }
      }
    }
    return null;
  }, [timeline]);

  // Helper function to find clips involved in transitions at current time
  const findTransitionClipsAtTime = useCallback((time: number): { 
    outgoingClip: ClipType | null, 
    incomingClip: ClipType | null, 
    transitionProgress: number 
  } => {
    // Check all video tracks for transition scenarios
    for (const track of timeline.videoTracks) {
      for (let i = 0; i < track.length; i++) {
        const currentClip = track[i];
        const nextClip = i + 1 < track.length ? track[i + 1] : null;
        
        // Check if current clip has a transition and there's a next clip
        if (currentClip.transition && nextClip) {
          const transitionStartTime = currentClip.startTime + currentClip.duration - currentClip.transition.duration;
          const transitionEndTime = currentClip.startTime + currentClip.duration;
          
          // Check if we're in the transition period
          if (time >= transitionStartTime && time <= transitionEndTime) {
            const transitionProgress = (time - transitionStartTime) / currentClip.transition.duration;
            return {
              outgoingClip: currentClip,
              incomingClip: nextClip,
              transitionProgress: Math.max(0, Math.min(1, transitionProgress))
            };
          }
        }
      }
    }
    
    return { outgoingClip: null, incomingClip: null, transitionProgress: 0 };
  }, [timeline]);

  // Enhanced state change detection to avoid unnecessary re-renders
  const lastRenderStateRef = useRef<{
    activeClipId: string | null;
    currentTime: number;
    selectedClipId: string | null;
    assetLibraryVersion: number;
    isPlaying: boolean;
    transitionProgress: number;
    outgoingClipId: string | null;
    incomingClipId: string | null;
  }>({
    activeClipId: null,
    currentTime: 0,
    selectedClipId: null,
    assetLibraryVersion: 0,
    isPlaying: false,
    transitionProgress: 0,
    outgoingClipId: null,
    incomingClipId: null
  });



  // Initialize PixiJS Application
  useEffect(() => {
    if (!canvasRef.current || isInitialized) return;

    const initPixi = async () => {
      try {
        setIsLoadingPreview(true);
        setPreviewError(null);

        // Create PIXI Application (v7 doesn't need init())
        const app = new PIXI.Application({
          width,
          height,
          backgroundColor: 0x000000,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        // Mount the canvas to the DOM using app.view (not app.canvas)
        if (canvasRef.current) {
          canvasRef.current.appendChild(app.view as HTMLCanvasElement);
        }

        // Store the app reference
        appRef.current = app;

        setIsInitialized(true);
        setIsLoadingPreview(false);
        console.log('PixiJS Preview Window initialized successfully');
        
        toast({
          title: "Preview Ready",
          description: "Video preview window initialized successfully.",
          variant: "success",
        });
        
      } catch (error) {
        console.error('Failed to initialize PixiJS:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize preview';
        setPreviewError(errorMessage);
        setIsLoadingPreview(false);
        
        toast({
          title: "Preview Error",
          description: errorMessage,
          variant: "destructive",
        });
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
    };
  }, [width, height, isInitialized]);

  // Handle canvas resize
  useEffect(() => {
    if (appRef.current && isInitialized) {
      appRef.current.renderer.resize(width, height);
    }
  }, [width, height, isInitialized]);

  // Load texture from asset URL with enhanced error handling
  const loadTexture = useCallback(async (asset: AssetType): Promise<PIXI.Texture | null> => {
    if (!asset.sourceUrl) return null;

    // Check if texture is already loaded
    const existingTexture = loadedTexturesRef.current.get(asset.assetId);
    if (existingTexture) {
      return existingTexture;
    }

    // Check if this asset is already in error state
    if (errorAssets.has(asset.assetId)) {
      return null;
    }

    // Mark as loading
    setLoadingAssets(prev => new Set(prev).add(asset.assetId));

    try {
      const texture = await PIXI.Texture.fromURL(asset.sourceUrl);
      loadedTexturesRef.current.set(asset.assetId, texture);
      
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
  }, [errorAssets]);

  // Cleanup unused textures to prevent memory leaks
  const cleanupUnusedTextures = useCallback(() => {
    const currentAssetIds = new Set(assetLibrary.map(asset => asset.assetId));
    const loadedAssetIds = Array.from(loadedTexturesRef.current.keys());
    
    // Remove textures for assets that no longer exist
    loadedAssetIds.forEach(assetId => {
      if (!currentAssetIds.has(assetId)) {
        const texture = loadedTexturesRef.current.get(assetId);
        if (texture) {
          texture.destroy(true);
          loadedTexturesRef.current.delete(assetId);
          console.log(`Cleaned up texture for removed asset: ${assetId}`);
        }
      }
    });

    // Clear error states for assets that no longer exist
    setErrorAssets(prev => {
      const newSet = new Set<string>();
      prev.forEach(assetId => {
        if (currentAssetIds.has(assetId)) {
          newSet.add(assetId);
        }
      });
      return newSet;
    });

    // Clear loading states for assets that no longer exist
    setLoadingAssets(prev => {
      const newSet = new Set<string>();
      prev.forEach(assetId => {
        if (currentAssetIds.has(assetId)) {
          newSet.add(assetId);
        }
      });
      return newSet;
    });
  }, [assetLibrary]);

  // Apply Ken Burns animation to sprite
  const applyKenBurnsAnimation = useCallback((sprite: PIXI.Sprite, clip: ClipType, relativeTime: number) => {
    if (!clip.animation || clip.animation.type !== 'ken_burns') {
      // Reset to default if no animation - maintain centered position and fit-to-screen scale
      return;
    }

    const { startRect, endRect } = clip.animation;
    
    // Ensure relativeTime is within bounds and calculate progress
    const clampedTime = Math.max(0, Math.min(relativeTime, clip.duration));
    const progress = clip.duration > 0 ? clampedTime / clip.duration : 0;

    // Linear interpolation between start and end positions/scales
    const currentScale = startRect.scale + (endRect.scale - startRect.scale) * progress;
    const currentX = startRect.x + (endRect.x - startRect.x) * progress;
    const currentY = startRect.y + (endRect.y - startRect.y) * progress;

    // Apply the Ken Burns transformation on top of the base centering
    // The base sprite is already centered and scaled to fit, so we apply additional transforms
    const baseScale = sprite.scale.x; // Get the current base scale
    sprite.scale.set(baseScale * currentScale);
    
    // Apply position offset from center
    sprite.x = width / 2 + currentX;
    sprite.y = height / 2 + currentY;
  }, [width, height]);

  // Render text overlays for a clip
  const renderTextOverlays = useCallback((app: PIXI.Application, clip: ClipType, relativeTime: number) => {
    if (!clip.textOverlays || clip.textOverlays.length === 0) {
      return;
    }

    // Filter overlays that should be visible at the current time
    const visibleOverlays = clip.textOverlays.filter(overlay => {
      const overlayEndTime = overlay.startTime + overlay.duration;
      return relativeTime >= overlay.startTime && relativeTime < overlayEndTime;
    });

    // Render each visible overlay
    visibleOverlays.forEach((overlay) => {
      // Calculate animation progress for the overlay
      const overlayRelativeTime = relativeTime - overlay.startTime;
      const overlayProgress = overlay.duration > 0 ? overlayRelativeTime / overlay.duration : 0;

      // Create text style with professional defaults
      const textStyle = new PIXI.TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: 0x000000,
        strokeThickness: 2,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4,
        dropShadowAngle: Math.PI / 6,
        dropShadowDistance: 2,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: width * 0.8, // Allow text to wrap within 80% of canvas width
      });

      // Create the text object
      const textObject = new PIXI.Text(overlay.text, textStyle);
      
      // Set anchor to center for easier positioning
      textObject.anchor.set(0.5);
      
      // Apply position (overlay.position is relative to canvas center)
      textObject.x = width / 2 + overlay.position.x;
      textObject.y = height / 2 + overlay.position.y;

      // Add subtle fade-in/fade-out animation
      const fadeInDuration = 0.3; // 300ms fade in
      const fadeOutDuration = 0.3; // 300ms fade out
      
      if (overlayRelativeTime < fadeInDuration) {
        // Fade in
        textObject.alpha = overlayRelativeTime / fadeInDuration;
      } else if (overlayRelativeTime > overlay.duration - fadeOutDuration) {
        // Fade out
        const fadeOutTime = overlayRelativeTime - (overlay.duration - fadeOutDuration);
        textObject.alpha = 1 - (fadeOutTime / fadeOutDuration);
      } else {
        // Fully visible
        textObject.alpha = 1;
      }

      // Ensure alpha is within bounds
      textObject.alpha = Math.max(0, Math.min(1, textObject.alpha));

      // Add subtle scale animation for emphasis
      const scaleAnimation = 1 + Math.sin(overlayProgress * Math.PI * 2) * 0.02; // 2% scale variation
      textObject.scale.set(scaleAnimation);

      // Add the text to the stage
      app.stage.addChild(textObject);
    });
  }, [width, height]);



  // Helper function to create and configure a sprite from an asset
  const createSpriteFromAsset = useCallback(async (asset: AssetType, clip: ClipType, relativeTime: number): Promise<PIXI.Sprite | null> => {
    // Only render image and video assets (audio assets don't have visual representation)
    if (asset.type === 'audio') {
      return null;
    }

    // Load texture for image/video assets
    const texture = await loadTexture(asset);
    if (!texture) {
      return null;
    }

    // Create sprite from texture
    const sprite = new PIXI.Sprite(texture);
    
    // Center the sprite and scale it to fit the preview window while maintaining aspect ratio
    const scaleX = width / texture.width;
    const scaleY = height / texture.height;
    const scale = Math.min(scaleX, scaleY);
    
    sprite.scale.set(scale);
    sprite.anchor.set(0.5);
    sprite.x = width / 2;
    sprite.y = height / 2;

    // Apply Ken Burns animation if present
    applyKenBurnsAnimation(sprite, clip, relativeTime);

    return sprite;
  }, [width, height, loadTexture, applyKenBurnsAnimation]);

  // Render the current frame based on timeline and current time
  const renderCurrentFrame = useCallback(async () => {
    if (!appRef.current || !isInitialized) return;

    const app = appRef.current;
    
    // Clear the stage
    app.stage.removeChildren();

    // Check for transitions first
    const transitionInfo = findTransitionClipsAtTime(currentTime);
    
    if (transitionInfo.outgoingClip && transitionInfo.incomingClip) {
      // We're in a transition - render both clips with alpha blending
      const outgoingAsset = findAssetById(transitionInfo.outgoingClip.assetId);
      const incomingAsset = findAssetById(transitionInfo.incomingClip.assetId);
      
      if (outgoingAsset && incomingAsset) {
        // Handle loading states for both assets
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
          currentSpriteRef.current = null;
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
          currentSpriteRef.current = null;
          return;
        }

        // Calculate relative times for both clips
        const outgoingRelativeTime = currentTime - transitionInfo.outgoingClip.startTime;
        const incomingRelativeTime = currentTime - transitionInfo.incomingClip.startTime;
        
        // Create sprites for both clips
        const outgoingSprite = await createSpriteFromAsset(outgoingAsset, transitionInfo.outgoingClip, outgoingRelativeTime);
        const incomingSprite = await createSpriteFromAsset(incomingAsset, transitionInfo.incomingClip, incomingRelativeTime);
        
        // Apply cross-dissolve transition effect
        if (outgoingSprite) {
          outgoingSprite.alpha = 1 - transitionInfo.transitionProgress; // Fade out
          app.stage.addChild(outgoingSprite);
          
          // Render text overlays for outgoing clip
          renderTextOverlays(app, transitionInfo.outgoingClip, outgoingRelativeTime);
        }
        
        if (incomingSprite) {
          incomingSprite.alpha = transitionInfo.transitionProgress; // Fade in
          app.stage.addChild(incomingSprite);
          
          // Render text overlays for incoming clip (with adjusted alpha)
          const textContainer = new PIXI.Container();
          textContainer.alpha = transitionInfo.transitionProgress;
          app.stage.addChild(textContainer);
          
          // Temporarily add text overlays to container for alpha blending
          const originalStage = app.stage;
          app.stage = textContainer;
          renderTextOverlays(app, transitionInfo.incomingClip, incomingRelativeTime);
          app.stage = originalStage;
        }
        
        // Add selection highlight for the appropriate clip
        const selectedClip = selectedClipId === transitionInfo.outgoingClip.clipId ? transitionInfo.outgoingClip :
                            selectedClipId === transitionInfo.incomingClip.clipId ? transitionInfo.incomingClip : null;
        
        if (selectedClip) {
          const border = new PIXI.Graphics();
          border.lineStyle(4, 0x4A90E2, 1);
          border.drawRect(-2, -2, width + 4, height + 4);
          app.stage.addChild(border);
        }
        
        // Store reference to the more prominent sprite
        currentSpriteRef.current = transitionInfo.transitionProgress > 0.5 ? incomingSprite : outgoingSprite;
        return;
      }
    }

    // No transition - render single active clip
    const activeClip = findActiveClipAtTime(currentTime);
    
    if (!activeClip) {
      // No active clip - show empty preview with message
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
      currentSpriteRef.current = null;
      return;
    }

    // Find the corresponding asset
    const asset = findAssetById(activeClip.assetId);
    if (!asset) {
      // Asset not found - show error message
      const style = new PIXI.TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xff6b6b,
        align: 'center',
      });

      const text = new PIXI.Text(`Asset not found: ${activeClip.assetId}`, style);
      text.anchor.set(0.5);
      text.x = width / 2;
      text.y = height / 2;
      
      app.stage.addChild(text);
      currentSpriteRef.current = null;
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
      currentSpriteRef.current = null;
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
      currentSpriteRef.current = null;
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
      currentSpriteRef.current = null;
      return;
    }

    // Calculate relative time for the active clip
    const relativeTime = currentTime - activeClip.startTime;
    
    // Create sprite for the active clip
    const sprite = await createSpriteFromAsset(asset, activeClip, relativeTime);
    
    if (!sprite) {
      // Failed to create sprite - show error
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
      currentSpriteRef.current = null;
      return;
    }

    // Add selection highlight if this clip is selected
    if (selectedClipId === activeClip.clipId) {
      const border = new PIXI.Graphics();
      border.lineStyle(4, 0x4A90E2, 1);
      border.drawRect(-2, -2, width + 4, height + 4);
      app.stage.addChild(border);
    }

    app.stage.addChild(sprite);
    currentSpriteRef.current = sprite;

    // Render text overlays for the active clip
    renderTextOverlays(app, activeClip, relativeTime);

  }, [isInitialized, currentTime, selectedClipId, width, height, findActiveClipAtTime, findAssetById, findTransitionClipsAtTime, createSpriteFromAsset, loadingAssets, errorAssets, renderTextOverlays]);



  // Initial render when state changes (for non-playback scenarios)
  useEffect(() => {
    if (!isPlaying && isInitialized) {
      renderCurrentFrame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, selectedClipId, assetLibrary.length, isPlaying, isInitialized]);

  // PixiJS ticker for continuous rendering loop during playback
  useEffect(() => {
    if (!appRef.current || !isInitialized) return;

    const app = appRef.current;
    
    // Create ticker function for continuous rendering during playback
    const renderTicker = () => {
      if (isPlaying) {
        // Inline the render state check to avoid dependency issues - include transition detection
        const activeClip = findActiveClipAtTime(currentTime);
        const activeClipId = activeClip?.clipId || null;
        const assetLibraryVersion = assetLibrary.length;
        const transitionInfo = findTransitionClipsAtTime(currentTime);
        
        const currentState = {
          activeClipId,
          currentTime,
          selectedClipId,
          assetLibraryVersion,
          isPlaying,
          transitionProgress: transitionInfo.transitionProgress,
          outgoingClipId: transitionInfo.outgoingClip?.clipId || null,
          incomingClipId: transitionInfo.incomingClip?.clipId || null
        };
        
        const lastState = lastRenderStateRef.current;
        
        // Check if any relevant state has changed - including transition state
        const hasChanged = (
          lastState.activeClipId !== currentState.activeClipId ||
          Math.abs(lastState.currentTime - currentState.currentTime) > 0.01 ||
          lastState.selectedClipId !== currentState.selectedClipId ||
          lastState.assetLibraryVersion !== currentState.assetLibraryVersion ||
          lastState.isPlaying !== currentState.isPlaying ||
          Math.abs(lastState.transitionProgress - currentState.transitionProgress) > 0.01 ||
          lastState.outgoingClipId !== currentState.outgoingClipId ||
          lastState.incomingClipId !== currentState.incomingClipId
        );
        
        if (hasChanged) {
          lastRenderStateRef.current = currentState;
          renderCurrentFrame();
        }
      }
    };

    // Store reference to ticker function for cleanup
    tickerFunctionRef.current = renderTicker;

    // Add ticker function to PixiJS ticker
    app.ticker.add(renderTicker);

    // Cleanup: remove ticker function when component unmounts or dependencies change
    return () => {
      if (app.ticker && tickerFunctionRef.current) {
        app.ticker.remove(tickerFunctionRef.current);
        tickerFunctionRef.current = null;
      }
    };
  }, [isInitialized, isPlaying, currentTime, selectedClipId, assetLibrary.length, findActiveClipAtTime, renderCurrentFrame]);

  // Cleanup unused textures when asset library changes
  useEffect(() => {
    cleanupUnusedTextures();
  }, [cleanupUnusedTextures]);

  // Error recovery mechanism - retry failed assets after a delay
  useEffect(() => {
    if (errorAssets.size === 0) return;

    const retryTimer = setTimeout(() => {
      // Clear error states to allow retry
      setErrorAssets(new Set());
      console.log('Retrying failed asset loads...');
    }, 5000); // Retry after 5 seconds

    return () => clearTimeout(retryTimer);
  }, [errorAssets.size]);

  return (
    <div className="w-full h-full flex flex-col">
      <div 
        className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden"
        role="img"
        aria-label="Video preview window"
        aria-describedby="preview-instructions"
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
      <div id="preview-instructions" className="sr-only">
        Video preview window showing the current frame at {currentTime.toFixed(2)} seconds. 
        {isPlaying ? 'Video is currently playing.' : 'Video is paused.'} 
        {selectedClipId ? `Selected clip: ${selectedClipId.slice(0, 8)}` : 'No clip selected.'}
        Use timeline controls to navigate and play/pause the video.
      </div>
      
      {/* Enhanced debug info with render stats */}
      <div className="mt-2 text-xs text-muted-foreground space-y-1">
        <div>
          Status: {isInitialized ? 'Initialized' : 'Loading...'}
          {selectedClipId && ` | Selected: ${selectedClipId.slice(0, 8)}...`}
          {` | Time: ${currentTime.toFixed(2)}s`}
          {isPlaying && ' | Playing'}
        </div>
        <div>
          Frames: {renderStats.frameCount} | Skipped: {renderStats.skipCount} | 
          Last render: {renderStats.lastRenderTime.toFixed(2)}ms |
          Textures: {loadedTexturesRef.current.size} |
          Loading: {loadingAssets.size} | Errors: {errorAssets.size}
        </div>
      </div>
    </div>
  );
};