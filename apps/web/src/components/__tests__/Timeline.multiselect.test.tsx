import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock filmstrip cache
vi.mock('../../utils/filmstripCache', () => ({
  filmstripCache: {
    loadImage: vi.fn().mockResolvedValue(new Image()),
    getImage: vi.fn().mockReturnValue(null),
    clear: vi.fn(),
    preloadFilmstrip: vi.fn().mockResolvedValue(undefined),
    preloadBatch: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('Timeline Multi-Select Functionality', () => {
  const mockAsset1: AssetType = {
    assetId: 'asset-1',
    fileName: 'test-video-1.mp4',
    type: 'video',
    sourceUrl: 'http://example.com/video1.mp4',
    duration: 10,
    isPlaceholder: false
  };

  const mockAsset2: AssetType = {
    assetId: 'asset-2',
    fileName: 'test-video-2.mp4',
    type: 'video',
    sourceUrl: 'http://example.com/video2.mp4',
    duration: 8,
    isPlaceholder: false
  };

  const mockClip1: ClipType = {
    clipId: 'clip-1',
    assetId: 'asset-1',
    startTime: 0,
    duration: 5,
    volume: 1,
    textOverlays: []
  };

  const mockClip2: ClipType = {
    clipId: 'clip-2',
    assetId: 'asset-2',
    startTime: 6,
    duration: 4,
    volume: 1,
    textOverlays: []
  };

  const mockActions = {
    updateClipProperties: vi.fn(),
    setSelectedClipId: vi.fn(),
    addClipToTimeline: vi.fn(),
    setCurrentTime: vi.fn(),
    setSelectedClipIds: vi.fn(),
    toggleSelection: vi.fn(),
    clearSelection: vi.fn(),
    deleteSelectedClips: vi.fn(),
    moveSelectedClips: vi.fn()
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock returns
    mockUseTimeline.mockReturnValue({
      videoTracks: [[mockClip1, mockClip2]],
      audioTracks: []
    });
    mockUseTimelineScale.mockReturnValue(50);
    mockUseSelectedClipId.mockReturnValue(null);
    mockUseSelectedClipIds.mockReturnValue([]);
    mockUseCurrentTime.mockReturnValue(0);
    mockUseAetherActions.mockReturnValue(mockActions);
    mockUseAssetLibrary.mockReturnValue([mockAsset1, mockAsset2]);
  });

  it('should render timeline with multiple clips', () => {
    render(<Timeline width={800} height={400} />);
    
    // Should render the timeline stage
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
    
    // Should render layers
    expect(screen.getByTestId('konva-layer')).toBeInTheDocument();
  });

  it('should show visual indicators for multi-selected clips', () => {
    // Mock multi-selection state
    mockUseSelectedClipIds.mockReturnValue(['clip-1', 'clip-2']);
    mockUseSelectedClipId.mockReturnValue(null); // No primary selection when multiple selected
    
    render(<Timeline width={800} height={400} />);
    
    // Component should render without errors
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('should handle single selection vs multi-selection', () => {
    // Test single selection
    mockUseSelectedClipIds.mockReturnValue(['clip-1']);
    mockUseSelectedClipId.mockReturnValue('clip-1');
    
    const { rerender } = render(<Timeline width={800} height={400} />);
    
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
    
    // Test multi-selection
    mockUseSelectedClipIds.mockReturnValue(['clip-1', 'clip-2']);
    mockUseSelectedClipId.mockReturnValue(null);
    
    rerender(<Timeline width={800} height={400} />);
    
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('should handle keyboard events for multi-select operations', () => {
    mockUseSelectedClipIds.mockReturnValue(['clip-1', 'clip-2']);
    
    render(<Timeline width={800} height={400} />);
    
    // Simulate Delete key press
    fireEvent.keyDown(document, { key: 'Delete' });
    
    // Should call deleteSelectedClips when clips are selected
    expect(mockActions.deleteSelectedClips).toHaveBeenCalled();
  });

  it('should handle Escape key to clear selection', () => {
    mockUseSelectedClipIds.mockReturnValue(['clip-1', 'clip-2']);
    
    render(<Timeline width={800} height={400} />);
    
    // Simulate Escape key press
    fireEvent.keyDown(document, { key: 'Escape' });
    
    // Should call clearSelection
    expect(mockActions.clearSelection).toHaveBeenCalled();
  });

  it('should not handle keyboard events when input is focused', () => {
    mockUseSelectedClipIds.mockReturnValue(['clip-1', 'clip-2']);
    
    // Create a mock input element and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    
    render(<Timeline width={800} height={400} />);
    
    // Simulate Delete key press while input is focused
    fireEvent.keyDown(document, { key: 'Delete' });
    
    // Should NOT call deleteSelectedClips when input is focused
    expect(mockActions.deleteSelectedClips).not.toHaveBeenCalled();
    
    // Cleanup
    document.body.removeChild(input);
  });

  it('should handle empty selection state', () => {
    mockUseSelectedClipIds.mockReturnValue([]);
    mockUseSelectedClipId.mockReturnValue(null);
    
    render(<Timeline width={800} height={400} />);
    
    // Simulate Delete key press with no selection
    fireEvent.keyDown(document, { key: 'Delete' });
    
    // Should not call deleteSelectedClips when nothing is selected
    expect(mockActions.deleteSelectedClips).not.toHaveBeenCalled();
  });
});