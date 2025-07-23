import { renderHook, act } from '@testing-library/react';
import { useAetherStore } from '../useAetherStore';
import { AssetType } from '@aether-editor/types';

describe('useAetherStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useAetherStore());
    act(() => {
      result.current.resetProject();
    });
  });

  it('should initialize with default project state', () => {
    const { result } = renderHook(() => useAetherStore());
    
    expect(result.current.projectSettings.name).toBe('Untitled Project');
    expect(result.current.projectSettings.resolution).toBe('1080p');
    expect(result.current.projectSettings.fps).toBe(30);
    expect(result.current.projectSettings.duration).toBe(60);
    expect(result.current.assetLibrary).toEqual([]);
    expect(result.current.timeline.videoTracks).toEqual([[]]);
    expect(result.current.timeline.audioTracks).toEqual([[]]);
    expect(result.current.selectedClipId).toBeNull();
    expect(result.current.currentTime).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.timelineScale).toBe(50);
  });

  it('should add assets to the library', () => {
    const { result } = renderHook(() => useAetherStore());
    
    const testAsset: AssetType = {
      assetId: 'test-asset-1',
      fileName: 'test.jpg',
      type: 'image',
      duration: 5,
      isPlaceholder: false
    };

    act(() => {
      result.current.addAsset(testAsset);
    });

    expect(result.current.assetLibrary).toHaveLength(1);
    expect(result.current.assetLibrary[0]).toEqual(testAsset);
  });

  it('should update asset properties', () => {
    const { result } = renderHook(() => useAetherStore());
    
    const testAsset: AssetType = {
      assetId: 'test-asset-1',
      fileName: 'test.jpg',
      type: 'image',
      duration: 5,
      isPlaceholder: false
    };

    act(() => {
      result.current.addAsset(testAsset);
      result.current.updateAsset('test-asset-1', { fileName: 'updated.jpg' });
    });

    expect(result.current.assetLibrary[0].fileName).toBe('updated.jpg');
  });

  it('should add clips to timeline', () => {
    const { result } = renderHook(() => useAetherStore());
    
    const testAsset: AssetType = {
      assetId: 'test-asset-1',
      fileName: 'test.jpg',
      type: 'image',
      duration: 5,
      isPlaceholder: false
    };

    act(() => {
      result.current.addAsset(testAsset);
      result.current.addClipToTimeline(testAsset, 10);
    });

    expect(result.current.timeline.videoTracks[0]).toHaveLength(1);
    expect(result.current.timeline.videoTracks[0][0].assetId).toBe('test-asset-1');
    expect(result.current.timeline.videoTracks[0][0].startTime).toBe(10);
    expect(result.current.timeline.videoTracks[0][0].duration).toBe(5);
  });

  it('should update clip properties', () => {
    const { result } = renderHook(() => useAetherStore());
    
    const testAsset: AssetType = {
      assetId: 'test-asset-1',
      fileName: 'test.jpg',
      type: 'image',
      duration: 5,
      isPlaceholder: false
    };

    act(() => {
      result.current.addAsset(testAsset);
      result.current.addClipToTimeline(testAsset, 10);
    });

    const clipId = result.current.timeline.videoTracks[0][0].clipId;

    act(() => {
      result.current.updateClipProperties(clipId, { volume: 0.5 });
    });

    expect(result.current.timeline.videoTracks[0][0].volume).toBe(0.5);
  });

  it('should handle playback state', () => {
    const { result } = renderHook(() => useAetherStore());

    act(() => {
      result.current.setPlaying(true);
      result.current.setCurrentTime(15);
    });

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentTime).toBe(15);
  });

  it('should handle selection state', () => {
    const { result } = renderHook(() => useAetherStore());

    act(() => {
      result.current.setSelectedClipId('test-clip-id');
    });

    expect(result.current.selectedClipId).toBe('test-clip-id');
  });

  it('should handle timeline scale', () => {
    const { result } = renderHook(() => useAetherStore());

    act(() => {
      result.current.setTimelineScale(100);
    });

    expect(result.current.timelineScale).toBe(100);

    // Test clamping
    act(() => {
      result.current.setTimelineScale(5); // Below minimum
    });

    expect(result.current.timelineScale).toBe(10);

    act(() => {
      result.current.setTimelineScale(300); // Above maximum
    });

    expect(result.current.timelineScale).toBe(200);
  });
});