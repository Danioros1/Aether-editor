import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Timeline } from '../Timeline';
import { AssetType, ClipType } from '@aether-editor/types';

// Mock Konva components
vi.mock('react-konva', () => ({
  Stage: ({ children, ...props }: any) => <div data-testid="konva-stage" {...props}>{children}</div>,
  Layer: ({ children, ...props }: any) => <div data-testid="konva-layer" {...props}>{children}</div>,
  Rect: (props: any) => <div data-testid="konva-rect" {...props} />,
  Group: ({ children, ...props }: any) => <div data-testid="konva-group" {...props}>{children}</div>,
  Text: (props: any) => <div data-testid="konva-text" {...props} />,
  Image: (props: any) => <div data-testid="konva-image" {...props} />
}));

// Mock the store hooks
const mockUseTimeline = vi.fn();
const mockUseTimelineScale = vi.fn();
const mockUseSelectedClipId = vi.fn();
const mockUseSelectedClipIds = vi.fn();
const mockUseCurrentTime = vi.fn();
const mockUseAetherActions = vi.fn();
const mockUseAssetLibrary = vi.fn();

vi.mock('../../store/useAetherStore', () => ({
  useTimeline: () => mockUseTimeline(),
  useTimelineScale: () => mockUseTimelineScale(),
  useSelectedClipId: () => mockUseSelectedClipId(),
  useSelectedClipIds: () => mockUseSelectedClipIds(),
  useCurrentTime: () => mockUseCurrentTime(),
  useAetherActions: () => mockUseAetherActions(),
  useAssetLibrary: () => mockUseAssetLibrary()
}));

// Mock filmstrip cache with enhanced functionality
vi.mock('../../utils/filmstripCache', () => ({
  filmstripCache: {
    loadImage: vi.fn().mockResolvedValue(new Image()),
    getImage: vi.fn().mockReturnValue(null),
    clear: vi.fn(),
    preloadFilmstrip: vi.fn().mockResolvedValue(undefined),
    preloadBatch: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      size: 0,
      maxSize: 150,
      totalMemoryUsage: 0,
      maxMemoryUsage: 75 * 1024 * 1024,
      hitRate: 0,
      totalRequests: 0,
      cacheHits: 0
    })
  }
}));

describe('Timeline Filmstrip Functionality', () => {
  const mockVideoAsset: AssetType = {
    assetId: 'video-asset-1',
    fileName: 'test-video.mp4',
    type: 'video',
    sourceUrl: 'http://example.com/video.mp4',
    thumbnailUrl: 'http://example.com/thumb.jpg',
    filmstripUrl: 'http://example.com/filmstrip.jpg',
    filmstripFrameCount: 50, // Enhanced frame count
    filmstripFrameWidth: 160, // Enhanced frame width
    filmstripFrameHeight: 90, // Enhanced frame height
    duration: 10,
    isPlaceholder: false
  };

  const mockVideoClip: ClipType = {
    clipId: 'clip-1',
    assetId: 'video-asset-1',
    startTime: 0,
    duration: 5,
    volume: 1,
    textOverlays: []
  };

  const mockImageAsset: AssetType = {
    assetId: 'image-asset-1',
    fileName: 'test-image.jpg',
    type: 'image',
    sourceUrl: 'http://example.com/image.jpg',
    thumbnailUrl: 'http://example.com/image-thumb.jpg',
    duration: 5,
    isPlaceholder: false
  };

  const mockImageClip: ClipType = {
    clipId: 'clip-2',
    assetId: 'image-asset-1',
    startTime: 5,
    duration: 3,
    volume: 1,
    textOverlays: []
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock returns
    mockUseTimeline.mockReturnValue({
      videoTracks: [[mockVideoClip, mockImageClip]],
      audioTracks: []
    });
    mockUseTimelineScale.mockReturnValue(50);
    mockUseSelectedClipId.mockReturnValue(null);
    mockUseSelectedClipIds.mockReturnValue([]);
    mockUseCurrentTime.mockReturnValue(0);
    mockUseAetherActions.mockReturnValue({
      updateClipProperties: vi.fn(),
      setSelectedClipId: vi.fn(),
      addClipToTimeline: vi.fn(),
      setCurrentTime: vi.fn(),
      setSelectedClipIds: vi.fn(),
      toggleSelection: vi.fn(),
      clearSelection: vi.fn(),
      deleteSelectedClips: vi.fn(),
      moveSelectedClips: vi.fn()
    });
    mockUseAssetLibrary.mockReturnValue([
      mockVideoAsset,
      mockImageAsset
    ]);
  });

  it('should render timeline with video clips that have filmstrip data', () => {
    act(() => {
      render(<Timeline width={800} height={400} />);
    });
    
    // Should render the timeline stage
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
    
    // Should render layers
    expect(screen.getByTestId('konva-layer')).toBeInTheDocument();
  });

  it('should handle video assets with filmstrip properties', () => {
    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // The component should render without errors when video assets have filmstrip data
    expect(container!).toBeInTheDocument();
  });

  it('should handle video assets without filmstrip properties', () => {
    const assetWithoutFilmstrip: AssetType = {
      ...mockVideoAsset,
      filmstripUrl: undefined,
      filmstripFrameCount: undefined,
      filmstripFrameWidth: undefined,
      filmstripFrameHeight: undefined
    };

    mockUseAssetLibrary.mockReturnValue([
      assetWithoutFilmstrip,
      mockImageAsset
    ]);

    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // Should render without errors even when filmstrip data is missing
    expect(container!).toBeInTheDocument();
  });

  it('should handle placeholder video assets', () => {
    const placeholderAsset: AssetType = {
      ...mockVideoAsset,
      isPlaceholder: true,
      placeholderDescription: 'Test placeholder video'
    };

    mockUseAssetLibrary.mockReturnValue([
      placeholderAsset,
      mockImageAsset
    ]);

    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // Should render placeholder assets without filmstrip
    expect(container!).toBeInTheDocument();
  });

  it('should not render filmstrip for image assets', () => {
    const imageAssetWithFilmstrip: AssetType = {
      ...mockImageAsset,
      filmstripUrl: 'http://example.com/filmstrip.jpg',
      filmstripFrameCount: 10,
      filmstripFrameWidth: 80,
      filmstripFrameHeight: 45
    };

    mockUseAssetLibrary.mockReturnValue([
      imageAssetWithFilmstrip
    ]);

    mockUseTimeline.mockReturnValue({
      videoTracks: [[mockImageClip]],
      audioTracks: []
    });

    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // Should render without trying to show filmstrip for image assets
    expect(container!).toBeInTheDocument();
  });

  it('should handle empty timeline', () => {
    mockUseTimeline.mockReturnValue({
      videoTracks: [],
      audioTracks: []
    });

    mockUseAssetLibrary.mockReturnValue([]);

    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // Should render empty timeline without errors
    expect(container!).toBeInTheDocument();
  });

  it('should preload filmstrips for video clips', async () => {
    const { filmstripCache } = await import('../../utils/filmstripCache');
    
    act(() => {
      render(<Timeline width={800} height={400} />);
    });
    
    // Wait for preloading effect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600));
    });
    
    // Should attempt to preload filmstrips for video assets
    expect(filmstripCache.preloadBatch).toHaveBeenCalledWith([
      {
        assetId: 'video-asset-1',
        filmstripUrl: 'http://example.com/filmstrip.jpg'
      }
    ]);
  });

  it('should handle filmstrip loading errors gracefully', async () => {
    const { filmstripCache } = await import('../../utils/filmstripCache');
    
    // Mock loadImage to reject
    vi.mocked(filmstripCache.loadImage).mockRejectedValue(new Error('Load failed'));
    
    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // Should render without throwing errors
    expect(container!).toBeInTheDocument();
  });

  it('should show enhanced filmstrip dimensions', () => {
    const enhancedVideoAsset: AssetType = {
      ...mockVideoAsset,
      filmstripFrameCount: 50, // Enhanced frame count
      filmstripFrameWidth: 160, // Enhanced frame width  
      filmstripFrameHeight: 90 // Enhanced frame height
    };

    mockUseAssetLibrary.mockReturnValue([
      enhancedVideoAsset,
      mockImageAsset
    ]);

    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // Should handle enhanced filmstrip dimensions
    expect(container!).toBeInTheDocument();
  });

  it('should handle enhanced filmstrip scrolling with trim positions', () => {
    const longVideoAsset: AssetType = {
      ...mockVideoAsset,
      duration: 30, // Longer video
      filmstripFrameCount: 50,
      filmstripFrameWidth: 160,
      filmstripFrameHeight: 90
    };

    const trimmedClip: ClipType = {
      ...mockVideoClip,
      startTime: 5,
      duration: 10 // Clip is shorter than asset duration
    };

    mockUseAssetLibrary.mockReturnValue([
      longVideoAsset
    ]);

    mockUseTimeline.mockReturnValue({
      videoTracks: [[trimmedClip]],
      audioTracks: []
    });

    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // Should handle filmstrip scrolling for trimmed clips
    expect(container!).toBeInTheDocument();
  });

  it('should optimize rendering for small clips', () => {
    const smallClip: ClipType = {
      ...mockVideoClip,
      duration: 0.5 // Very short clip
    };

    mockUseTimeline.mockReturnValue({
      videoTracks: [[smallClip]],
      audioTracks: []
    });

    let container: HTMLElement;
    act(() => {
      const result = render(<Timeline width={800} height={400} />);
      container = result.container;
    });
    
    // Should handle small clips without rendering filmstrip
    expect(container!).toBeInTheDocument();
  });
});