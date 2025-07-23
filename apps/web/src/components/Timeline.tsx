import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Group, Text, Image, Line } from 'react-konva';
import Konva from 'konva';
import { 
  useTimeline, 
  useTimelineScale, 
  useSelectedClipId,
  useSelectedClipIds, 
  useCurrentTime,
  useAetherActions,
  useAssetLibrary 
} from '../store/useAetherStore';
import { ClipType, AssetType } from '@aether-editor/types';
import { filmstripCache } from '../utils/filmstripCache';
import { useToast } from '../hooks/use-toast';
import { LoadingOverlay } from './ui/loading-spinner';
import { ErrorState } from './ui/feedback';

interface TimelineProps {
  width: number;
  height: number;
}

const TRACK_HEIGHT = 60;
const TRACK_PADDING = 10;
const CLIP_HEIGHT = 40;
const TIMELINE_HEADER_HEIGHT = 30;

export const Timeline: React.FC<TimelineProps> = ({ width, height }) => {
  const timeline = useTimeline();
  const timelineScale = useTimelineScale(); // pixels per second
  const selectedClipId = useSelectedClipId();
  const selectedClipIds = useSelectedClipIds();
  const currentTime = useCurrentTime();
  const assetLibrary = useAssetLibrary();
  const { 
    updateClipProperties, 
    setSelectedClipId, 
    addClipToTimeline,
    setSelectedClipIds,
    splitClip,
    removeClip,
    toggleSelection,
    clearSelection,
    deleteSelectedClips,
    moveSelectedClips
  } = useAetherActions();
  const { toast } = useToast();
  
  const stageRef = useRef<Konva.Stage>(null);
  const [draggedClip, setDraggedClip] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<number[]>([]);
  const [preloadedAssets, setPreloadedAssets] = useState<Set<string>>(new Set());
  
  // Multi-selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    clipId: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    clipId: null
  });

  // Initialize timeline loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Error handling for timeline operations
  useEffect(() => {
    const handleTimelineError = (error: any) => {
      console.error('Timeline error:', error);
      setTimelineError(error.message || 'Timeline error occurred');
      
      toast({
        title: "Timeline Error",
        description: error.message || 'An error occurred in the timeline',
        variant: "destructive",
      });
    };

    // Listen for timeline errors
    window.addEventListener('timeline:error', handleTimelineError);
    return () => window.removeEventListener('timeline:error', handleTimelineError);
  }, [toast]);

  // Keyboard event handling for multi-select operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when timeline is focused or no input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      );
      
      if (isInputFocused) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          deleteSelectedClips();
        }
      }
      
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipIds, deleteSelectedClips, clearSelection]);

  // Handle context menu actions
  const handleContextMenuAction = (action: string, clipId: string) => {
    setContextMenu({ visible: false, x: 0, y: 0, clipId: null });
    
    switch (action) {
      case 'split':
        splitClip(clipId, currentTime);
        break;
      case 'delete':
        if (selectedClipIds.includes(clipId) && selectedClipIds.length > 1) {
          deleteSelectedClips();
        } else {
          // Remove single clip
          removeClip(clipId);
        }
        break;
    }
  };

  // Hide context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ visible: false, x: 0, y: 0, clipId: null });
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  // Preload filmstrips for visible video clips
  useEffect(() => {
    const preloadFilmstrips = async () => {
      const videoClips = timeline.videoTracks.flat();
      const assetsToPreload = videoClips
        .map(clip => getAssetById(clip.assetId))
        .filter((asset): asset is AssetType => 
          asset !== undefined && 
          asset.type === 'video' && 
          !!asset.filmstripUrl && 
          !asset.isPlaceholder &&
          !preloadedAssets.has(asset.assetId)
        );

      if (assetsToPreload.length > 0) {
        const preloadItems = assetsToPreload.map(asset => ({
          assetId: asset.assetId,
          filmstripUrl: asset.filmstripUrl!
        }));

        try {
          await filmstripCache.preloadBatch(preloadItems);
          setPreloadedAssets(prev => {
            const newSet = new Set(prev);
            assetsToPreload.forEach(asset => newSet.add(asset.assetId));
            return newSet;
          });
        } catch (error) {
          console.debug('Filmstrip preload batch failed:', error);
        }
      }
    };

    // Debounce preloading to avoid excessive calls
    const timeoutId = setTimeout(preloadFilmstrips, 500);
    return () => clearTimeout(timeoutId);
  }, [timeline.videoTracks, assetLibrary, preloadedAssets]);

  // Convert time to pixel position
  const timeToPixels = (time: number): number => {
    return time * timelineScale;
  };

  // Convert pixel position to time
  const pixelsToTime = (pixels: number): number => {
    return pixels / timelineScale;
  };

  // Get asset by ID for clip rendering
  const getAssetById = (assetId: string): AssetType | undefined => {
    return assetLibrary.find(asset => asset.assetId === assetId);
  };

  // Handle clip selection with multi-select support
  const handleClipClick = (clipId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    const evt = e.evt;
    
    // Hide context menu on any click
    setContextMenu({ visible: false, x: 0, y: 0, clipId: null });
    
    if (evt.button === 2) {
      // Right click - show context menu
      evt.preventDefault();
      const stage = e.target.getStage();
      if (stage) {
        const pointerPosition = stage.getPointerPosition();
        if (pointerPosition) {
          // Select the clip if it's not already selected
          if (!selectedClipIds.includes(clipId)) {
            setSelectedClipId(clipId);
          }
          
          setContextMenu({
            visible: true,
            x: pointerPosition.x,
            y: pointerPosition.y,
            clipId: clipId
          });
        }
      }
      return;
    }
    
    if (evt.ctrlKey || evt.metaKey) {
      // Ctrl+click: toggle selection
      toggleSelection(clipId);
    } else if (evt.shiftKey && selectedClipIds.length > 0) {
      // Shift+click: select range
      const allClips = [...timeline.videoTracks.flat(), ...timeline.audioTracks.flat()];
      const currentIndex = allClips.findIndex(clip => clip.clipId === clipId);
      const lastSelectedIndex = allClips.findIndex(clip => selectedClipIds.includes(clip.clipId));
      
      if (currentIndex !== -1 && lastSelectedIndex !== -1) {
        const start = Math.min(currentIndex, lastSelectedIndex);
        const end = Math.max(currentIndex, lastSelectedIndex);
        const rangeClipIds = allClips.slice(start, end + 1).map(clip => clip.clipId);
        setSelectedClipIds(rangeClipIds);
      }
    } else {
      // Regular click: single selection
      setSelectedClipId(clipId);
    }
  };

  // Handle clip drag end
  const handleClipDragEnd = (clipId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const newStartTime = pixelsToTime(e.target.x());
    
    if (selectedClipIds.includes(clipId) && selectedClipIds.length > 1) {
      // Multi-selection drag: calculate delta and move all selected clips
      const originalClip = findClipById(clipId);
      if (originalClip) {
        const deltaTime = newStartTime - originalClip.startTime;
        moveSelectedClips(deltaTime);
        
        // Show feedback toast
        toast({
          title: "Clips Moved",
          description: `Moved ${selectedClipIds.length} clips by ${deltaTime.toFixed(1)}s`,
          variant: "default",
        });
      }
    } else {
      // Single clip drag
      const clampedStartTime = Math.max(0, newStartTime);
      updateClipProperties(clipId, { startTime: clampedStartTime });
      
      // Show feedback toast for significant moves
      const originalClip = findClipById(clipId);
      if (originalClip && Math.abs(clampedStartTime - originalClip.startTime) > 0.5) {
        toast({
          title: "Clip Moved",
          description: `Moved to ${clampedStartTime.toFixed(1)}s`,
          variant: "default",
        });
      }
    }
    
    setDraggedClip(null);
    setIsDraggingSelection(false);
    setSnapGuides([]); // Clear snap guides
  };

  // Handle clip drag start
  const handleClipDragStart = (clipId: string) => {
    setDraggedClip(clipId);
    
    // If dragging a clip that's part of multi-selection, set flag
    if (selectedClipIds.includes(clipId) && selectedClipIds.length > 1) {
      setIsDraggingSelection(true);
    }
  };

  // Get all snap points for snapping functionality
  const getSnapPoints = (excludeClipId?: string): number[] => {
    const snapPoints: number[] = [];
    
    // Add playhead position
    snapPoints.push(currentTime);
    
    // Add all clip start and end times
    [...timeline.videoTracks, ...timeline.audioTracks].forEach(track => {
      track.forEach(clip => {
        if (clip.clipId !== excludeClipId) {
          snapPoints.push(clip.startTime);
          snapPoints.push(clip.startTime + clip.duration);
        }
      });
    });
    
    // Add timeline start
    snapPoints.push(0);
    
    return snapPoints.sort((a, b) => a - b);
  };

  // Apply snapping to a time value and update snap guides
  const applySnapping = (time: number, excludeClipId?: string): number => {
    const snapThreshold = 0.5; // 0.5 seconds snap threshold
    const snapPoints = getSnapPoints(excludeClipId);
    const activeSnapPoints: number[] = [];
    
    let snappedTime = time;
    for (const snapPoint of snapPoints) {
      if (Math.abs(time - snapPoint) <= snapThreshold) {
        snappedTime = snapPoint;
        activeSnapPoints.push(snapPoint);
        break;
      }
    }
    
    // Update snap guides
    setSnapGuides(activeSnapPoints);
    
    return snappedTime;
  };

  // Handle left trim handle drag
  const handleLeftTrimDrag = (clipId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const clip = findClipById(clipId);
    if (!clip) return;

    const newX = e.target.x();
    const newStartTime = pixelsToTime(newX);
    const originalEndTime = clip.startTime + clip.duration;
    
    // Apply snapping
    const snappedStartTime = applySnapping(newStartTime, clipId);
    
    // Ensure we don't drag past the end of the clip or into negative time
    const clampedStartTime = Math.max(0, Math.min(snappedStartTime, originalEndTime - 0.1));
    const newDuration = originalEndTime - clampedStartTime;
    
    updateClipProperties(clipId, { 
      startTime: clampedStartTime,
      duration: newDuration
    });
  };

  // Handle right trim handle drag
  const handleRightTrimDrag = (clipId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const clip = findClipById(clipId);
    if (!clip) return;

    const newX = e.target.x();
    const newEndTime = pixelsToTime(newX);
    
    // Apply snapping
    const snappedEndTime = applySnapping(newEndTime, clipId);
    const newDuration = snappedEndTime - clip.startTime;
    
    // Ensure minimum duration of 0.1 seconds
    const clampedDuration = Math.max(0.1, newDuration);
    
    updateClipProperties(clipId, { duration: clampedDuration });
  };

  // Handle trim drag end - clear snap guides
  const handleTrimDragEnd = () => {
    setSnapGuides([]);
  };

  // Find clip by ID across all tracks
  const findClipById = (clipId: string): ClipType | undefined => {
    for (const track of timeline.videoTracks) {
      const clip = track.find(c => c.clipId === clipId);
      if (clip) return clip;
    }
    for (const track of timeline.audioTracks) {
      const clip = track.find(c => c.clipId === clipId);
      if (clip) return clip;
    }
    return undefined;
  };

  // Enhanced Filmstrip component for video clips with better scrolling and trim support
  const FilmstripImage: React.FC<{
    clip: ClipType;
    asset: AssetType;
    x: number;
    y: number;
    clipWidth: number;
  }> = React.memo(({ clip, asset, x, y, clipWidth }) => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
      if (!asset.filmstripUrl || !asset.assetId) return;

      // Reset states
      setLoadError(false);
      setImageLoaded(false);

      // Try to load from cache first, then from URL
      const loadFilmstrip = async () => {
        try {
          const img = await filmstripCache.loadImage(asset.assetId, asset.filmstripUrl!);
          setImage(img);
          setImageLoaded(true);
        } catch (error) {
          console.warn('Failed to load filmstrip image:', asset.filmstripUrl, error);
          setLoadError(true);
          setImageLoaded(false);
        }
      };

      loadFilmstrip();
    }, [asset.filmstripUrl, asset.assetId]);

    if (!imageLoaded || !image || !asset.filmstripFrameCount || !asset.filmstripFrameWidth || !asset.filmstripFrameHeight) {
      // Show loading indicator or error state
      if (loadError) {
        return (
          <Group x={x + 3} y={y + 3}>
            <Rect
              width={clipWidth - 6}
              height={CLIP_HEIGHT - 6}
              fill="rgba(239, 68, 68, 0.1)"
              stroke="rgba(239, 68, 68, 0.3)"
              strokeWidth={1}
              dash={[3, 3]}
              cornerRadius={2}
            />
            <Text
              text="Filmstrip Error"
              x={5}
              y={(CLIP_HEIGHT - 6) / 2 - 6}
              fontSize={8}
              fill="rgba(239, 68, 68, 0.8)"
              width={clipWidth - 16}
              align="center"
            />
          </Group>
        );
      }
      
      // Loading state
      return (
        <Group x={x + 3} y={y + 3}>
          <Rect
            width={clipWidth - 6}
            height={CLIP_HEIGHT - 6}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="rgba(59, 130, 246, 0.3)"
            strokeWidth={1}
            dash={[2, 2]}
            cornerRadius={2}
          />
          <Text
            text="Loading..."
            x={5}
            y={(CLIP_HEIGHT - 6) / 2 - 6}
            fontSize={8}
            fill="rgba(59, 130, 246, 0.8)"
            width={clipWidth - 16}
            align="center"
          />
        </Group>
      );
    }

    // Enhanced filmstrip scrolling calculation with intelligent trim support
    const originalAssetDuration = asset.duration || 10;
    
    // Enhanced clip trimming support - calculate based on clip position relative to asset
    // This provides better representation of what part of the video is actually shown
    const clipTrimStart = 0; // Future: clip.trimStart || 0
    const clipTrimEnd = 0;   // Future: clip.trimEnd || 0
    
    // Calculate the portion of the original asset this clip represents
    const effectiveAssetDuration = Math.max(originalAssetDuration - clipTrimStart - clipTrimEnd, 0.1);
    const clipStartPercent = clipTrimStart / originalAssetDuration;
    
    // Improved duration calculation with better bounds checking
    const maxClipDuration = effectiveAssetDuration;
    const actualClipDuration = Math.min(clip.duration, maxClipDuration);
    const clipDurationPercent = actualClipDuration / originalAssetDuration;
    
    // Calculate filmstrip dimensions and positioning with enhanced precision
    const filmstripTotalWidth = asset.filmstripFrameWidth * asset.filmstripFrameCount;
    const filmstripStartX = clipStartPercent * filmstripTotalWidth;
    const filmstripVisibleWidth = clipDurationPercent * filmstripTotalWidth;
    
    // Add intelligent frame alignment - align to frame boundaries for cleaner display
    const frameWidth = asset.filmstripFrameWidth;
    const alignedStartX = Math.floor(filmstripStartX / frameWidth) * frameWidth;
    const alignedVisibleWidth = Math.ceil(filmstripVisibleWidth / frameWidth) * frameWidth;
    
    // Scale filmstrip to fit clip height with better padding
    const filmstripDisplayHeight = CLIP_HEIGHT - 8; // 4px padding top/bottom
    const filmstripScale = filmstripDisplayHeight / asset.filmstripFrameHeight;
    
    // Calculate optimal crop and display dimensions with enhanced precision
    const maxCropWidth = filmstripTotalWidth - alignedStartX;
    const cropWidth = Math.min(alignedVisibleWidth, maxCropWidth, clipWidth / filmstripScale);
    const displayWidth = Math.min(clipWidth - 8, cropWidth * filmstripScale);
    
    // Enhanced performance optimization with better thresholds
    if (displayWidth < 40 || clipWidth < 50) {
      return null;
    }

    // Calculate frame boundaries for better visual alignment with sub-pixel precision
    const scaledFrameWidth = asset.filmstripFrameWidth * filmstripScale;
    const visibleFrames = Math.ceil(displayWidth / scaledFrameWidth);
    const actualFramesToShow = Math.min(visibleFrames, asset.filmstripFrameCount);
    
    // Calculate precise crop region for better quality
    const preciseCropX = alignedStartX;
    const preciseCropWidth = Math.min(cropWidth, filmstripTotalWidth - preciseCropX);
    
    return (
      <Group
        x={x + 4}
        y={y + 4}
        clipX={0}
        clipY={0}
        clipWidth={displayWidth}
        clipHeight={filmstripDisplayHeight}
      >
        {/* Main filmstrip image with enhanced rendering */}
        <Image
          image={image}
          x={-preciseCropX * filmstripScale}
          y={0}
          width={filmstripTotalWidth * filmstripScale}
          height={filmstripDisplayHeight}
          crop={{
            x: preciseCropX,
            y: 0,
            width: preciseCropWidth,
            height: asset.filmstripFrameHeight
          }}
          opacity={0.92}
          imageSmoothingEnabled={true}
          filters={[]} // Ensure no filters interfere with quality
        />
        
        {/* Enhanced frame separators for better visual clarity */}
        {actualFramesToShow > 1 && Array.from({ length: actualFramesToShow - 1 }, (_, i) => {
          const separatorX = (i + 1) * scaledFrameWidth;
          return separatorX < displayWidth ? (
            <Rect
              key={`frame-sep-${i}`}
              x={separatorX}
              y={0}
              width={0.8}
              height={filmstripDisplayHeight}
              fill="rgba(0, 0, 0, 0.25)"
              listening={false}
            />
          ) : null;
        }).filter(Boolean)}
        
        {/* Subtle gradient overlay for better text readability */}
        <Rect
          width={displayWidth}
          height={filmstripDisplayHeight}
          fill="rgba(0, 0, 0, 0.05)"
          listening={false}
        />
        
        {/* Enhanced performance indicator for debugging */}
        {import.meta.env.DEV && displayWidth > 60 && (
          <Text
            text={`${actualFramesToShow}/${asset.filmstripFrameCount}f`}
            x={displayWidth - 35}
            y={2}
            fontSize={7}
            fill="rgba(255, 255, 255, 0.7)"
            listening={false}
            fontFamily="monospace"
          />
        )}
      </Group>
    );
  });

  // Render filmstrip for video clips
  const renderFilmstrip = (clip: ClipType, asset: AssetType, x: number, y: number, clipWidth: number) => {
    if (!asset.filmstripUrl || !asset.filmstripFrameCount || !asset.filmstripFrameWidth || !asset.filmstripFrameHeight) {
      return null;
    }

    return (
      <FilmstripImage
        clip={clip}
        asset={asset}
        x={x}
        y={y}
        clipWidth={clipWidth}
      />
    );
  };

  // Render a single clip
  const renderClip = (clip: ClipType, trackIndex: number, trackType: 'video' | 'audio') => {
    const asset = getAssetById(clip.assetId);
    const x = timeToPixels(clip.startTime);
    const clipWidth = timeToPixels(clip.duration);
    const y = TIMELINE_HEADER_HEIGHT + (trackIndex * (TRACK_HEIGHT + TRACK_PADDING)) + TRACK_PADDING;
    
    const isSelected = selectedClipIds.includes(clip.clipId);
    const isPrimarySelection = selectedClipId === clip.clipId;
    const isDragging = draggedClip === clip.clipId;
    const isPlaceholder = asset?.isPlaceholder || false;
    const hasFilmstrip = asset?.filmstripUrl && trackType === 'video' && !isPlaceholder;
    
    // Color based on track type, selection state, and placeholder status
    let fillColor: string;
    let strokeColor: string;
    let strokeWidth: number;
    
    if (isPlaceholder) {
      // Orange colors for placeholder clips
      fillColor = isSelected ? '#f97316' : '#fb923c';
      strokeColor = isSelected ? '#ea580c' : '#f97316';
      strokeWidth = isSelected ? (isPrimarySelection ? 3 : 2) : 1;
    } else if (hasFilmstrip) {
      // Darker background for filmstrip clips to let filmstrip show through
      fillColor = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(107, 114, 128, 0.3)';
      strokeColor = isSelected ? (isPrimarySelection ? '#1d4ed8' : '#3b82f6') : '#374151';
      strokeWidth = isSelected ? (isPrimarySelection ? 3 : 2) : 1;
    } else {
      // Normal colors for regular clips
      fillColor = trackType === 'video' 
        ? (isSelected ? '#3b82f6' : '#6b7280') 
        : (isSelected ? '#10b981' : '#6b7280');
      strokeColor = isSelected ? (isPrimarySelection ? '#1d4ed8' : '#3b82f6') : '#374151';
      strokeWidth = isSelected ? (isPrimarySelection ? 3 : 2) : 1;
    }
    
    const opacity = isDragging ? 0.7 : 1;

    return (
      <Group key={clip.clipId}>
        {/* Main clip group */}
        <Group
          x={x}
          y={y}
          draggable
          onDragStart={() => handleClipDragStart(clip.clipId)}
          onDragEnd={(e) => handleClipDragEnd(clip.clipId, e)}
          onClick={(e) => handleClipClick(clip.clipId, e)}
          onTap={(e) => handleClipClick(clip.clipId, e as any)}
          onContextMenu={(e) => handleClipClick(clip.clipId, e)}
          dragBoundFunc={(pos) => ({
            x: Math.max(0, pos.x), // Prevent dragging to negative positions
            y: y // Lock vertical position
          })}
        >
          {/* Clip background */}
          <Rect
            width={clipWidth}
            height={CLIP_HEIGHT}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            cornerRadius={4}
            opacity={opacity}
            dash={isPlaceholder ? [5, 5] : undefined} // Dashed border for placeholders
          />
          
          {/* Filmstrip overlay for video clips */}
          {hasFilmstrip && asset && renderFilmstrip(clip, asset, 0, 0, clipWidth)}
          
          {/* Loading indicator for filmstrip */}
          {trackType === 'video' && !isPlaceholder && asset?.filmstripUrl && !hasFilmstrip && (
            <Rect
              x={2}
              y={2}
              width={clipWidth - 4}
              height={CLIP_HEIGHT - 4}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth={1}
              dash={[3, 3]}
              cornerRadius={2}
            />
          )}
          
          {/* Placeholder pattern overlay */}
          {isPlaceholder && (
            <>
              {/* Diagonal stripes pattern for placeholder */}
              <Rect
                width={clipWidth}
                height={CLIP_HEIGHT}
                fill="rgba(251, 146, 60, 0.2)"
                cornerRadius={4}
                opacity={opacity}
              />
              {/* Add diagonal lines pattern */}
              {Array.from({ length: Math.ceil(clipWidth / 10) }, (_, i) => (
                <Rect
                  key={`stripe-${i}`}
                  x={i * 10 - 5}
                  y={-5}
                  width={2}
                  height={CLIP_HEIGHT + 10}
                  fill="rgba(234, 88, 12, 0.3)"
                  rotation={45}
                  opacity={opacity}
                />
              ))}
            </>
          )}
          
          {/* Clip text - only show if no filmstrip or for placeholders */}
          {(!hasFilmstrip || isPlaceholder) && (
            <Text
              text={asset?.fileName || 'Unknown Asset'}
              x={5}
              y={isPlaceholder ? 5 : 8}
              fontSize={12}
              fill="white"
              width={clipWidth - 10}
              height={isPlaceholder ? 15 : CLIP_HEIGHT - 10}
              verticalAlign="middle"
              ellipsis={true}
              fontStyle={isPlaceholder ? 'italic' : 'normal'}
            />
          )}
          
          {/* Placeholder indicator text */}
          {isPlaceholder && (
            <Text
              text="PLACEHOLDER"
              x={5}
              y={22}
              fontSize={8}
              fill="rgba(255, 255, 255, 0.8)"
              width={clipWidth - 10}
              height={15}
              verticalAlign="middle"
              fontStyle="bold"
            />
          )}
          
          {/* Filmstrip overlay with semi-transparent text for video clips */}
          {hasFilmstrip && !isPlaceholder && (
            <Text
              text={asset?.fileName || 'Unknown Asset'}
              x={5}
              y={CLIP_HEIGHT - 15}
              fontSize={10}
              fill="rgba(255, 255, 255, 0.9)"
              width={clipWidth - 10}
              height={12}
              verticalAlign="middle"
              ellipsis={true}
              shadowColor="rgba(0, 0, 0, 0.8)"
              shadowBlur={2}
              shadowOffsetX={1}
              shadowOffsetY={1}
            />
          )}
        </Group>
        
        {/* Trim handles - rendered separately to avoid interference with clip dragging */}
        {isSelected && (
          <>
            {/* Left trim handle */}
            <Group
              x={x - 2}
              y={y}
              draggable
              dragBoundFunc={(pos) => ({
                x: Math.max(0, Math.min(pos.x, x + clipWidth - timeToPixels(0.1))), // Prevent dragging past clip end
                y: y // Lock vertical position
              })}
              onDragMove={(e) => handleLeftTrimDrag(clip.clipId, e)}
              onDragEnd={handleTrimDragEnd}
            >
              <Rect
                width={6}
                height={CLIP_HEIGHT}
                fill="#1d4ed8"
                stroke="#ffffff"
                strokeWidth={1}
                cornerRadius={2}
                shadowColor="#000000"
                shadowBlur={2}
                shadowOpacity={0.3}
              />
              {/* Visual indicator for left trim */}
              <Rect
                x={1}
                y={CLIP_HEIGHT / 2 - 8}
                width={1}
                height={16}
                fill="#ffffff"
                opacity={0.8}
              />
              <Rect
                x={3}
                y={CLIP_HEIGHT / 2 - 8}
                width={1}
                height={16}
                fill="#ffffff"
                opacity={0.8}
              />
            </Group>
            
            {/* Right trim handle */}
            <Group
              x={x + clipWidth - 4}
              y={y}
              draggable
              dragBoundFunc={(pos) => ({
                x: Math.max(x + timeToPixels(0.1), pos.x), // Prevent dragging past clip start
                y: y // Lock vertical position
              })}
              onDragMove={(e) => handleRightTrimDrag(clip.clipId, e)}
              onDragEnd={handleTrimDragEnd}
            >
              <Rect
                width={6}
                height={CLIP_HEIGHT}
                fill="#1d4ed8"
                stroke="#ffffff"
                strokeWidth={1}
                cornerRadius={2}
                shadowColor="#000000"
                shadowBlur={2}
                shadowOpacity={0.3}
              />
              {/* Visual indicator for right trim */}
              <Rect
                x={1}
                y={CLIP_HEIGHT / 2 - 8}
                width={1}
                height={16}
                fill="#ffffff"
                opacity={0.8}
              />
              <Rect
                x={3}
                y={CLIP_HEIGHT / 2 - 8}
                width={1}
                height={16}
                fill="#ffffff"
                opacity={0.8}
              />
            </Group>
          </>
        )}
      </Group>
    );
  };

  // Render track background
  const renderTrackBackground = (trackIndex: number, trackType: 'video' | 'audio') => {
    const y = TIMELINE_HEADER_HEIGHT + (trackIndex * (TRACK_HEIGHT + TRACK_PADDING));
    const trackColor = trackType === 'video' ? '#1f2937' : '#065f46';
    
    return (
      <Rect
        key={`${trackType}-track-${trackIndex}`}
        x={0}
        y={y}
        width={width}
        height={TRACK_HEIGHT}
        fill={trackColor}
        stroke="#374151"
        strokeWidth={1}
      />
    );
  };

  // Render time ruler
  const renderTimeRuler = () => {
    const rulers = [];
    const maxTime = Math.ceil(width / timelineScale);
    
    for (let time = 0; time <= maxTime; time += 1) {
      const x = timeToPixels(time);
      
      // Major tick every second
      rulers.push(
        <Group key={`ruler-${time}`}>
          <Rect
            x={x}
            y={0}
            width={1}
            height={TIMELINE_HEADER_HEIGHT}
            fill="#6b7280"
          />
          <Text
            x={x + 2}
            y={5}
            text={`${time}s`}
            fontSize={10}
            fill="#9ca3af"
          />
        </Group>
      );
    }
    
    return rulers;
  };

  // Handle timeline click for seeking
  const handleTimelineClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Don't handle if clicking on a clip
    if (e.target !== e.target.getStage()) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    
    const evt = e.evt;
    
    // If not holding Ctrl/Cmd, clear selection and seek
    if (!evt.ctrlKey && !evt.metaKey) {
      clearSelection();
      const clickTime = pixelsToTime(pointerPosition.x);
      const { setCurrentTime } = useAetherActions();
      setCurrentTime(Math.max(0, clickTime));
    }
  };

  // Handle mouse down for selection rectangle
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Only start selection if clicking on empty space
    if (e.target !== e.target.getStage()) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    
    const evt = e.evt;
    
    // Start selection rectangle if holding Ctrl/Cmd or Shift
    if (evt.ctrlKey || evt.metaKey || evt.shiftKey) {
      setIsSelecting(true);
      setSelectionStart(pointerPosition);
      setSelectionEnd(pointerPosition);
    }
  };

  // Handle mouse move for selection rectangle
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isSelecting || !selectionStart) return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    
    setSelectionEnd(pointerPosition);
  };

  // Handle mouse up for selection rectangle
  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }
    
    // Calculate selection rectangle
    const rect = {
      x: Math.min(selectionStart.x, selectionEnd.x),
      y: Math.min(selectionStart.y, selectionEnd.y),
      width: Math.abs(selectionEnd.x - selectionStart.x),
      height: Math.abs(selectionEnd.y - selectionStart.y)
    };
    
    // Find clips within selection rectangle
    const selectedClips: string[] = [];
    
    [...timeline.videoTracks, ...timeline.audioTracks].forEach((track, trackIndex) => {
      track.forEach(clip => {
        const clipX = timeToPixels(clip.startTime);
        const clipWidth = timeToPixels(clip.duration);
        const clipY = TIMELINE_HEADER_HEIGHT + (trackIndex * (TRACK_HEIGHT + TRACK_PADDING)) + TRACK_PADDING;
        
        // Check if clip intersects with selection rectangle
        if (clipX < rect.x + rect.width &&
            clipX + clipWidth > rect.x &&
            clipY < rect.y + rect.height &&
            clipY + CLIP_HEIGHT > rect.y) {
          selectedClips.push(clip.clipId);
        }
      });
    });
    
    // Update selection
    if (selectedClips.length > 0) {
      const evt = e.evt;
      if (evt.ctrlKey || evt.metaKey) {
        // Add to existing selection
        const newSelection = [...new Set([...selectedClipIds, ...selectedClips])];
        setSelectedClipIds(newSelection);
      } else {
        // Replace selection
        setSelectedClipIds(selectedClips);
      }
    }
    
    // Clean up selection state
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  // Render snap guides with enhanced visual feedback
  const renderSnapGuides = () => {
    return snapGuides.map((snapTime, index) => {
      const x = timeToPixels(snapTime);
      return (
        <Group key={`snap-guide-${index}`} listening={false}>
          {/* Glow effect */}
          <Rect
            x={x - 2}
            y={0}
            width={4}
            height={height}
            fill="#fbbf24"
            opacity={0.2}
            listening={false}
          />
          {/* Main snap guide line */}
          <Line
            points={[x, 0, x, height]}
            stroke="#fbbf24"
            strokeWidth={2}
            opacity={0.9}
            dash={[5, 5]}
            listening={false}
          />
          {/* Time indicator at top */}
          <Group x={x} y={8}>
            <Rect
              x={-15}
              y={-6}
              width={30}
              height={12}
              fill="#fbbf24"
              cornerRadius={6}
              opacity={0.95}
              listening={false}
            />
            <Text
              text={`${snapTime.toFixed(1)}s`}
              x={-13}
              y={-3}
              fontSize={8}
              fill="white"
              fontStyle="bold"
              width={26}
              align="center"
              listening={false}
            />
          </Group>
          {/* Bottom indicator */}
          <Rect
            x={x - 4}
            y={height - 12}
            width={8}
            height={8}
            fill="#fbbf24"
            cornerRadius={4}
            opacity={0.9}
            listening={false}
          />
        </Group>
      );
    });
  };

  // Render selection rectangle
  const renderSelectionRectangle = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) return null;
    
    const rect = {
      x: Math.min(selectionStart.x, selectionEnd.x),
      y: Math.min(selectionStart.y, selectionEnd.y),
      width: Math.abs(selectionEnd.x - selectionStart.x),
      height: Math.abs(selectionEnd.y - selectionStart.y)
    };
    
    return (
      <Group key="selection-rectangle">
        {/* Selection rectangle background */}
        <Rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[5, 5]}
          listening={false}
        />
      </Group>
    );
  };

  // Render multi-selection indicators
  const renderMultiSelectionIndicators = () => {
    if (selectedClipIds.length <= 1 || !isDraggingSelection) return null;
    
    const indicators: JSX.Element[] = [];
    
    [...timeline.videoTracks, ...timeline.audioTracks].forEach((track, trackIndex) => {
      track.forEach(clip => {
        if (selectedClipIds.includes(clip.clipId) && clip.clipId !== draggedClip) {
          const x = timeToPixels(clip.startTime);
          const clipWidth = timeToPixels(clip.duration);
          const y = TIMELINE_HEADER_HEIGHT + (trackIndex * (TRACK_HEIGHT + TRACK_PADDING)) + TRACK_PADDING;
          
          indicators.push(
            <Group key={`multi-select-indicator-${clip.clipId}`}>
              <Rect
                x={x}
                y={y}
                width={clipWidth}
                height={CLIP_HEIGHT}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth={2}
                dash={[3, 3]}
                cornerRadius={4}
                listening={false}
              />
            </Group>
          );
        }
      });
    });
    
    return indicators;
  };

  // Render playhead
  const renderPlayhead = () => {
    const x = timeToPixels(currentTime);
    
    return (
      <Group key="playhead">
        {/* Playhead line */}
        <Rect
          x={x - 1}
          y={0}
          width={2}
          height={height}
          fill="#ef4444"
          listening={false}
        />
        {/* Playhead handle */}
        <Rect
          x={x - 6}
          y={0}
          width={12}
          height={18}
          fill="#ef4444"
          cornerRadius={3}
          listening={false}
        />
        {/* Playhead triangle indicator */}
        <Rect
          x={x - 4}
          y={15}
          width={8}
          height={8}
          fill="#ef4444"
          rotation={45}
          offsetX={4}
          offsetY={4}
          listening={false}
        />
      </Group>
    );
  };

  // Handle drag over
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  // Handle drag leave
  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  // Handle drop
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    try {
      const assetData = event.dataTransfer.getData('application/json');
      if (!assetData) return;
      
      const asset: AssetType = JSON.parse(assetData);
      
      // Calculate drop position
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Convert x position to time
      const startTime = pixelsToTime(x);
      
      // Determine track type and index based on y position
      const trackY = y - TIMELINE_HEADER_HEIGHT;
      const trackIndex = Math.floor(trackY / (TRACK_HEIGHT + TRACK_PADDING));
      
      // Determine if it's a video or audio track
      const isVideoTrack = trackIndex < timeline.videoTracks.length;
      const trackType = isVideoTrack ? 'video' : 'audio';
      const actualTrackIndex = isVideoTrack ? trackIndex : trackIndex - timeline.videoTracks.length;
      
      // Add clip to timeline
      addClipToTimeline(asset, Math.max(0, startTime), trackType, Math.max(0, actualTrackIndex));
      
    } catch (error) {
      console.error('Error dropping asset:', error);
    }
  };

  // Render context menu
  const renderContextMenu = () => {
    if (!contextMenu.visible || !contextMenu.clipId) return null;
    
    const clip = findClipById(contextMenu.clipId);
    if (!clip) return null;
    
    // Check if the playhead is within the clip bounds for split option
    const canSplit = currentTime > clip.startTime && currentTime < (clip.startTime + clip.duration);
    
    return (
      <div
        className="fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 py-1 min-w-32"
        style={{
          left: contextMenu.x,
          top: contextMenu.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {canSplit && (
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => handleContextMenuAction('split', contextMenu.clipId!)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Split Clip
          </button>
        )}
        <button
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2"
          onClick={() => handleContextMenuAction('delete', contextMenu.clipId!)}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Clip{selectedClipIds.includes(contextMenu.clipId) && selectedClipIds.length > 1 ? 's' : ''}
        </button>
      </div>
    );
  };

  // Show error state if there's a timeline error
  if (timelineError) {
    return (
      <div className="h-full flex items-center justify-center">
        <ErrorState
          title="Timeline Error"
          description={timelineError}
          onRetry={() => {
            setTimelineError(null);
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 300);
          }}
          retryText="Reload Timeline"
        />
      </div>
    );
  }

  return (
    <LoadingOverlay isLoading={isLoading} text="Loading timeline...">
      <div 
        className={`timeline-container bg-gray-900 rounded-lg overflow-hidden relative ${
          dragOver ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label="Video timeline editor"
        tabIndex={0}
        aria-describedby="timeline-instructions"
      >
      {/* Screen reader instructions */}
      <div id="timeline-instructions" className="sr-only">
        Timeline editor. Use arrow keys to navigate, Space to play/pause, C to split clips, Delete to remove clips. 
        Click and drag clips to move them. Use Ctrl+click for multi-selection.
      </div>
      
      <Stage 
        width={width} 
        height={height} 
        ref={stageRef} 
        onClick={handleTimelineClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        aria-label="Timeline canvas"
      >
        <Layer>
          {/* Time ruler */}
          <Rect
            x={0}
            y={0}
            width={width}
            height={TIMELINE_HEADER_HEIGHT}
            fill="#111827"
            stroke="#374151"
            strokeWidth={1}
          />
          {renderTimeRuler()}
          
          {/* Video tracks */}
          {timeline.videoTracks.map((track, index) => (
            <React.Fragment key={`video-track-${index}`}>
              {renderTrackBackground(index, 'video')}
              {track.map(clip => renderClip(clip, index, 'video'))}
            </React.Fragment>
          ))}
          
          {/* Audio tracks */}
          {timeline.audioTracks.map((track, index) => {
            const trackIndex = timeline.videoTracks.length + index;
            return (
              <React.Fragment key={`audio-track-${index}`}>
                {renderTrackBackground(trackIndex, 'audio')}
                {track.map(clip => renderClip(clip, trackIndex, 'audio'))}
              </React.Fragment>
            );
          })}
          
          {/* Snap guides - render before playhead */}
          {renderSnapGuides()}
          
          {/* Selection rectangle */}
          {renderSelectionRectangle()}
          
          {/* Multi-selection indicators */}
          {renderMultiSelectionIndicators()}
          
          {/* Playhead - render last so it's on top */}
          {renderPlayhead()}
        </Layer>
      </Stage>
      
      {/* Context Menu */}
      {renderContextMenu()}
      </div>
    </LoadingOverlay>
  );
};