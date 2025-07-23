import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Group, Text, Image } from 'react-konva';
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
import { performanceMonitor } from '../utils/performanceMonitor';

interface OptimizedTimelineProps {
  width: number;
  height: number;
}

const TRACK_HEIGHT = 60;
const TRACK_PADDING = 10;
const CLIP_HEIGHT = 40;
const TIMELINE_HEADER_HEIGHT = 30;

// Viewport culling - only render clips that are visible
const useViewportCulling = (clips: ClipType[], timelineScale: number, viewportWidth: number, scrollX: number = 0) => {
  return useMemo(() => {
    const viewportStartTime = scrollX / timelineScale;
    const viewportEndTime = (scrollX + viewportWidth) / timelineScale;
    const buffer = 5; // 5 second buffer on each side
    
    return clips.filter(clip => {
      const clipEndTime = clip.startTime + clip.duration;
      return clipEndTime >= (viewportStartTime - buffer) && clip.startTime <= (viewportEndTime + buffer);
    });
  }, [clips, timelineScale, viewportWidth, scrollX]);
};

// Optimized clip rendering with reduced re-renders
const OptimizedClip = React.memo<{
  clip: ClipType;
  asset: AssetType | undefined;
  x: number;
  y: number;
  clipWidth: number;
  isSelected: boolean;
  isPrimarySelection: boolean;
  isDragging: boolean;
  onClipClick: (clipId: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onClipDragStart: (clipId: string) => void;
  onClipDragEnd: (clipId: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onLeftTrimDrag: (clipId: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onRightTrimDrag: (clipId: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onTrimDragEnd: () => void;
}>(({ 
  clip, 
  asset, 
  x, 
  y, 
  clipWidth, 
  isSelected, 
  isPrimarySelection, 
  isDragging,
  onClipClick,
  onClipDragStart,
  onClipDragEnd,
  onLeftTrimDrag,
  onRightTrimDrag,
  onTrimDragEnd
}) => {
  const isPlaceholder = asset?.isPlaceholder || false;
  const hasFilmstrip = asset?.filmstripUrl && asset.type === 'video' && !isPlaceholder;
  
  // Color based on track type, selection state, and placeholder status
  let fillColor: string;
  let strokeColor: string;
  let strokeWidth: number;
  
  if (isPlaceholder) {
    fillColor = isSelected ? '#f97316' : '#fb923c';
    strokeColor = isSelected ? '#ea580c' : '#f97316';
    strokeWidth = isSelected ? (isPrimarySelection ? 3 : 2) : 1;
  } else if (hasFilmstrip) {
    fillColor = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(107, 114, 128, 0.3)';
    strokeColor = isSelected ? (isPrimarySelection ? '#1d4ed8' : '#3b82f6') : '#374151';
    strokeWidth = isSelected ? (isPrimarySelection ? 3 : 2) : 1;
  } else {
    fillColor = isSelected ? '#3b82f6' : '#6b7280';
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
        onDragStart={() => onClipDragStart(clip.clipId)}
        onDragEnd={(e) => onClipDragEnd(clip.clipId, e)}
        onClick={(e) => onClipClick(clip.clipId, e)}
        onTap={(e) => onClipClick(clip.clipId, e as any)}
        onContextMenu={(e) => onClipClick(clip.clipId, e)}
        dragBoundFunc={(pos) => ({
          x: Math.max(0, pos.x),
          y: y
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
          dash={isPlaceholder ? [5, 5] : undefined}
        />
        
        {/* Filmstrip overlay for video clips */}
        {hasFilmstrip && asset && (
          <OptimizedFilmstrip
            clip={clip}
            asset={asset}
            clipWidth={clipWidth}
          />
        )}
        
        {/* Clip text */}
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
        
        {/* Filmstrip overlay text */}
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
      
      {/* Trim handles - only render if selected */}
      {isSelected && (
        <>
          {/* Left trim handle */}
          <Group
            x={x - 2}
            y={y}
            draggable
            dragBoundFunc={(pos) => ({
              x: Math.max(0, Math.min(pos.x, x + clipWidth - 20)),
              y: y
            })}
            onDragMove={(e) => onLeftTrimDrag(clip.clipId, e)}
            onDragEnd={onTrimDragEnd}
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
              x: Math.max(x + 20, pos.x),
              y: y
            })}
            onDragMove={(e) => onRightTrimDrag(clip.clipId, e)}
            onDragEnd={onTrimDragEnd}
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
});

OptimizedClip.displayName = 'OptimizedClip';

// Optimized filmstrip component with better memory management
const OptimizedFilmstrip = React.memo<{
  clip: ClipType;
  asset: AssetType;
  clipWidth: number;
}>(({ clip, asset, clipWidth }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!asset.filmstripUrl || !asset.assetId) return;

    setLoadError(false);
    setImageLoaded(false);

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
    if (loadError) {
      return (
        <Group x={3} y={3}>
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
    
    return (
      <Group x={3} y={3}>
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

  // Optimized filmstrip calculation
  const originalAssetDuration = asset.duration || 10;
  const clipTrimStart = 0;
  const clipTrimEnd = 0;
  
  const effectiveAssetDuration = Math.max(originalAssetDuration - clipTrimStart - clipTrimEnd, 0.1);
  const clipStartPercent = clipTrimStart / originalAssetDuration;
  
  const maxClipDuration = effectiveAssetDuration;
  const actualClipDuration = Math.min(clip.duration, maxClipDuration);
  const clipDurationPercent = actualClipDuration / originalAssetDuration;
  
  const filmstripTotalWidth = asset.filmstripFrameWidth * asset.filmstripFrameCount;
  const filmstripStartX = clipStartPercent * filmstripTotalWidth;
  const filmstripVisibleWidth = clipDurationPercent * filmstripTotalWidth;
  
  const frameWidth = asset.filmstripFrameWidth;
  const alignedStartX = Math.floor(filmstripStartX / frameWidth) * frameWidth;
  const alignedVisibleWidth = Math.ceil(filmstripVisibleWidth / frameWidth) * frameWidth;
  
  const filmstripDisplayHeight = CLIP_HEIGHT - 8;
  const filmstripScale = filmstripDisplayHeight / asset.filmstripFrameHeight;
  
  const maxCropWidth = filmstripTotalWidth - alignedStartX;
  const cropWidth = Math.min(alignedVisibleWidth, maxCropWidth, clipWidth / filmstripScale);
  const displayWidth = Math.min(clipWidth - 8, cropWidth * filmstripScale);
  
  // Performance optimization - don't render very small filmstrips
  if (displayWidth < 40 || clipWidth < 50) {
    return null;
  }

  const preciseCropX = alignedStartX;
  const preciseCropWidth = Math.min(cropWidth, filmstripTotalWidth - preciseCropX);
  
  return (
    <Group
      x={4}
      y={4}
      clipX={0}
      clipY={0}
      clipWidth={displayWidth}
      clipHeight={filmstripDisplayHeight}
    >
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
      />
      
      <Rect
        width={displayWidth}
        height={filmstripDisplayHeight}
        fill="rgba(0, 0, 0, 0.05)"
        listening={false}
      />
    </Group>
  );
});

OptimizedFilmstrip.displayName = 'OptimizedFilmstrip';

export const OptimizedTimeline: React.FC<OptimizedTimelineProps> = ({ width, height }) => {
  const timeline = useTimeline();
  const timelineScale = useTimelineScale();
  const selectedClipId = useSelectedClipId();
  const selectedClipIds = useSelectedClipIds();
  const currentTime = useCurrentTime();
  const assetLibrary = useAssetLibrary();
  const { 
    updateClipProperties, 
    setSelectedClipId, 
    setSelectedClipIds,
    toggleSelection,
    moveSelectedClips
  } = useAetherActions();
  
  const stageRef = useRef<Konva.Stage>(null);
  const [draggedClip, setDraggedClip] = useState<string | null>(null);
  const [dragOver] = useState(false);
  const [snapGuides, setSnapGuides] = useState<number[]>([]);
  const [preloadedAssets, setPreloadedAssets] = useState<Set<string>>(new Set());
  
  // Multi-selection state
  // const [isSelecting, setIsSelecting] = useState(false);
  // const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  // const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const [_isDraggingSelection, setIsDraggingSelection] = useState(false);
  
  // Context menu state
  const [_contextMenu, setContextMenu] = useState<{
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

  // Performance optimization - use viewport culling for clips
  const allVideoClips = useMemo(() => timeline.videoTracks.flat(), [timeline.videoTracks]);
  const allAudioClips = useMemo(() => timeline.audioTracks.flat(), [timeline.audioTracks]);
  const visibleVideoClips = useViewportCulling(allVideoClips, timelineScale, width);
  const visibleAudioClips = useViewportCulling(allAudioClips, timelineScale, width);

  // Performance monitoring
  useEffect(() => {
    const handlePerformanceOptimization = (event: CustomEvent) => {
      const { severity } = event.detail;
      
      if (severity === 'critical') {
        // Reduce rendering quality for better performance
        console.log('OptimizedTimeline: Reducing rendering quality due to performance issues');
        
        // Clear preloaded assets to free memory
        setPreloadedAssets(new Set());
        
        // Force cleanup of filmstrip cache
        filmstripCache.clear();
      }
    };

    window.addEventListener('performance:optimizeRendering', handlePerformanceOptimization as EventListener);
    return () => window.removeEventListener('performance:optimizeRendering', handlePerformanceOptimization as EventListener);
  }, []);

  // Optimized preloading with performance monitoring
  useEffect(() => {
    const preloadFilmstrips = async () => {
      await performanceMonitor.measureAsyncComponentRender('timelineRenderTime', async () => {
        const videoClips = visibleVideoClips; // Only preload visible clips
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
      });
    };

    const timeoutId = setTimeout(preloadFilmstrips, 500);
    return () => clearTimeout(timeoutId);
  }, [visibleVideoClips, assetLibrary, preloadedAssets]);

  // Convert time to pixel position
  const timeToPixels = useCallback((time: number): number => {
    return time * timelineScale;
  }, [timelineScale]);

  // Convert pixel position to time
  const pixelsToTime = useCallback((pixels: number): number => {
    return pixels / timelineScale;
  }, [timelineScale]);

  // Get asset by ID for clip rendering
  const getAssetById = useCallback((assetId: string): AssetType | undefined => {
    return assetLibrary.find(asset => asset.assetId === assetId);
  }, [assetLibrary]);

  // Handle clip selection with multi-select support
  const handleClipClick = useCallback((clipId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    const evt = e.evt;
    
    // setContextMenu({ visible: false, x: 0, y: 0, clipId: null });
    
    if (evt.button === 2) {
      evt.preventDefault();
      const stage = e.target.getStage();
      if (stage) {
        const pointerPosition = stage.getPointerPosition();
        if (pointerPosition) {
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
      toggleSelection(clipId);
    } else if (evt.shiftKey && selectedClipIds.length > 0) {
      const allClips = [...allVideoClips, ...allAudioClips];
      const currentIndex = allClips.findIndex(clip => clip.clipId === clipId);
      const lastSelectedIndex = allClips.findIndex(clip => selectedClipIds.includes(clip.clipId));
      
      if (currentIndex !== -1 && lastSelectedIndex !== -1) {
        const start = Math.min(currentIndex, lastSelectedIndex);
        const end = Math.max(currentIndex, lastSelectedIndex);
        const rangeClipIds = allClips.slice(start, end + 1).map(clip => clip.clipId);
        setSelectedClipIds(rangeClipIds);
      }
    } else {
      setSelectedClipId(clipId);
    }
  }, [selectedClipIds, allVideoClips, allAudioClips, setSelectedClipId, setSelectedClipIds, toggleSelection]);

  // Handle clip drag end
  const handleClipDragEnd = useCallback((clipId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const newStartTime = pixelsToTime(e.target.x());
    
    if (selectedClipIds.includes(clipId) && selectedClipIds.length > 1) {
      const originalClip = findClipById(clipId);
      if (originalClip) {
        const deltaTime = newStartTime - originalClip.startTime;
        moveSelectedClips(deltaTime);
      }
    } else {
      updateClipProperties(clipId, { startTime: Math.max(0, newStartTime) });
    }
    
    setDraggedClip(null);
    setIsDraggingSelection(false);
  }, [selectedClipIds, pixelsToTime, updateClipProperties, moveSelectedClips]);

  // Handle clip drag start
  const handleClipDragStart = useCallback((clipId: string) => {
    setDraggedClip(clipId);
    
    if (selectedClipIds.includes(clipId) && selectedClipIds.length > 1) {
      setIsDraggingSelection(true);
    }
  }, [selectedClipIds]);

  // Get all snap points for snapping functionality
  const getSnapPoints = useCallback((excludeClipId?: string): number[] => {
    const snapPoints: number[] = [];
    
    snapPoints.push(currentTime);
    
    [...allVideoClips, ...allAudioClips].forEach(clip => {
      if (clip.clipId !== excludeClipId) {
        snapPoints.push(clip.startTime);
        snapPoints.push(clip.startTime + clip.duration);
      }
    });
    
    snapPoints.push(0);
    
    return snapPoints.sort((a, b) => a - b);
  }, [currentTime, allVideoClips, allAudioClips]);

  // Apply snapping to a time value and update snap guides
  const applySnapping = useCallback((time: number, excludeClipId?: string): number => {
    const snapThreshold = 0.5;
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
    
    setSnapGuides(activeSnapPoints);
    
    return snappedTime;
  }, [getSnapPoints]);

  // Handle left trim handle drag
  const handleLeftTrimDrag = useCallback((clipId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const clip = findClipById(clipId);
    if (!clip) return;

    const newX = e.target.x();
    const newStartTime = pixelsToTime(newX);
    const originalEndTime = clip.startTime + clip.duration;
    
    const snappedStartTime = applySnapping(newStartTime, clipId);
    const clampedStartTime = Math.max(0, Math.min(snappedStartTime, originalEndTime - 0.1));
    const newDuration = originalEndTime - clampedStartTime;
    
    updateClipProperties(clipId, { 
      startTime: clampedStartTime,
      duration: newDuration
    });
  }, [pixelsToTime, applySnapping, updateClipProperties]);

  // Handle right trim handle drag
  const handleRightTrimDrag = useCallback((clipId: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const clip = findClipById(clipId);
    if (!clip) return;

    const newX = e.target.x();
    const newEndTime = pixelsToTime(newX);
    
    const snappedEndTime = applySnapping(newEndTime, clipId);
    const newDuration = snappedEndTime - clip.startTime;
    const clampedDuration = Math.max(0.1, newDuration);
    
    updateClipProperties(clipId, { duration: clampedDuration });
  }, [pixelsToTime, applySnapping, updateClipProperties]);

  // Handle trim drag end - clear snap guides
  const handleTrimDragEnd = useCallback(() => {
    setSnapGuides([]);
  }, []);

  // Find clip by ID across all tracks
  const findClipById = useCallback((clipId: string): ClipType | undefined => {
    for (const track of timeline.videoTracks) {
      const clip = track.find(c => c.clipId === clipId);
      if (clip) return clip;
    }
    for (const track of timeline.audioTracks) {
      const clip = track.find(c => c.clipId === clipId);
      if (clip) return clip;
    }
    return undefined;
  }, [timeline]);

  // Render optimized clips with viewport culling
  const renderOptimizedClips = useCallback((clips: ClipType[], trackIndex: number, _trackType: 'video' | 'audio') => {
    return clips.map(clip => {
      const asset = getAssetById(clip.assetId);
      const x = timeToPixels(clip.startTime);
      const clipWidth = timeToPixels(clip.duration);
      const y = TIMELINE_HEADER_HEIGHT + (trackIndex * (TRACK_HEIGHT + TRACK_PADDING)) + TRACK_PADDING;
      
      const isSelected = selectedClipIds.includes(clip.clipId);
      const isPrimarySelection = selectedClipId === clip.clipId;
      const isDragging = draggedClip === clip.clipId;

      return (
        <OptimizedClip
          key={clip.clipId}
          clip={clip}
          asset={asset}
          x={x}
          y={y}
          clipWidth={clipWidth}
          isSelected={isSelected}
          isPrimarySelection={isPrimarySelection}
          isDragging={isDragging}
          onClipClick={handleClipClick}
          onClipDragStart={handleClipDragStart}
          onClipDragEnd={handleClipDragEnd}
          onLeftTrimDrag={handleLeftTrimDrag}
          onRightTrimDrag={handleRightTrimDrag}
          onTrimDragEnd={handleTrimDragEnd}
        />
      );
    });
  }, [
    getAssetById, 
    timeToPixels, 
    selectedClipIds, 
    selectedClipId, 
    draggedClip,
    handleClipClick,
    handleClipDragStart,
    handleClipDragEnd,
    handleLeftTrimDrag,
    handleRightTrimDrag,
    handleTrimDragEnd
  ]);

  // Render track background
  const renderTrackBackground = useCallback((trackIndex: number, trackType: 'video' | 'audio') => {
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
  }, [width]);

  // Render time ruler with optimization
  const renderTimeRuler = useCallback(() => {
    const rulers = [];
    const maxTime = Math.ceil(width / timelineScale);
    const step = timelineScale < 20 ? 5 : 1; // Reduce ruler density at low zoom levels
    
    for (let time = 0; time <= maxTime; time += step) {
      const x = timeToPixels(time);
      
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
  }, [width, timelineScale, timeToPixels]);

  // Render snap guides
  const renderSnapGuides = useCallback(() => {
    return snapGuides.map((snapTime, index) => {
      const x = timeToPixels(snapTime);
      return (
        <Group key={`snap-guide-${index}`}>
          <Rect
            x={x - 0.5}
            y={0}
            width={1}
            height={height}
            fill="#fbbf24"
            opacity={0.8}
            listening={false}
          />
          <Rect
            x={x - 3}
            y={0}
            width={6}
            height={6}
            fill="#fbbf24"
            cornerRadius={3}
            listening={false}
          />
        </Group>
      );
    });
  }, [snapGuides, timeToPixels, height]);

  // Render playhead
  const renderPlayhead = useCallback(() => {
    const x = timeToPixels(currentTime);
    
    return (
      <Group key="playhead">
        <Rect
          x={x - 1}
          y={0}
          width={2}
          height={height}
          fill="#ef4444"
          listening={false}
        />
        <Rect
          x={x - 6}
          y={0}
          width={12}
          height={18}
          fill="#ef4444"
          cornerRadius={3}
          listening={false}
        />
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
  }, [currentTime, timeToPixels, height]);

  return (
    <div 
      className={`timeline-container bg-gray-900 rounded-lg overflow-hidden relative ${
        dragOver ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      }`}
      role="region"
      aria-label="Optimized video timeline editor"
      aria-describedby="optimized-timeline-instructions"
      tabIndex={0}
    >
      {/* Screen reader instructions */}
      <div id="optimized-timeline-instructions" className="sr-only">
        Optimized timeline editor. Use arrow keys to navigate, Space to play/pause, C to split clips, Delete to remove clips. 
        Click and drag clips to move them. Use Ctrl+click for multi-selection. This is the performance-optimized version.
      </div>
      <Stage 
        width={width} 
        height={height} 
        ref={stageRef} 
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
          
          {/* Video tracks with optimized rendering */}
          {timeline.videoTracks.map((_track, index) => (
            <React.Fragment key={`video-track-${index}`}>
              {renderTrackBackground(index, 'video')}
              {renderOptimizedClips(
                visibleVideoClips.filter(clip => 
                  timeline.videoTracks[index]?.some(trackClip => trackClip.clipId === clip.clipId)
                ), 
                index, 
                'video'
              )}
            </React.Fragment>
          ))}
          
          {/* Audio tracks with optimized rendering */}
          {timeline.audioTracks.map((_track, index) => {
            const trackIndex = timeline.videoTracks.length + index;
            return (
              <React.Fragment key={`audio-track-${index}`}>
                {renderTrackBackground(trackIndex, 'audio')}
                {renderOptimizedClips(
                  visibleAudioClips.filter(clip => 
                    timeline.audioTracks[index]?.some(trackClip => trackClip.clipId === clip.clipId)
                  ), 
                  trackIndex, 
                  'audio'
                )}
              </React.Fragment>
            );
          })}
          
          {/* Snap guides */}
          {renderSnapGuides()}
          
          {/* Playhead */}
          {renderPlayhead()}
        </Layer>
      </Stage>
    </div>
  );
};