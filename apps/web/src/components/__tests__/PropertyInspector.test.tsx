import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyInspector } from '../PropertyInspector';
import { useAetherStore } from '../../store/useAetherStore';
import { ClipType, AssetType } from '@aether-editor/types';

// Mock the store
const mockUpdateClipProperties = vi.fn();

vi.mock('../../store/useAetherStore', () => ({
  useAetherStore: vi.fn()
}));

describe('PropertyInspector', () => {
  const mockClip: ClipType = {
    clipId: 'test-clip-1',
    assetId: 'test-asset-1',
    startTime: 5.5,
    duration: 10.2,
    volume: 0.8,
    textOverlays: []
  };

  const mockAsset: AssetType = {
    assetId: 'test-asset-1',
    fileName: 'test-video.mp4',
    type: 'video',
    duration: 30,
    isPlaceholder: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the store state
    (useAetherStore as any).mockImplementation((selector: any) => {
      const state = {
        selectedClipId: 'test-clip-1',
        timeline: {
          videoTracks: [[mockClip]],
          audioTracks: [[]]
        },
        assetLibrary: [mockAsset],
        updateClipProperties: mockUpdateClipProperties
      };
      
      return selector(state);
    });
  });

  it('should render clip properties when a clip is selected', () => {
    render(<PropertyInspector />);
    
    expect(screen.getByDisplayValue('test-clip-1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-video.mp4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10.2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.8')).toBeInTheDocument();
  });

  it('should update clip properties when input values change', () => {
    render(<PropertyInspector />);
    
    const startTimeInput = screen.getByLabelText('Start Time (s)');
    fireEvent.change(startTimeInput, { target: { value: '7.5' } });
    
    expect(mockUpdateClipProperties).toHaveBeenCalledWith('test-clip-1', { startTime: 7.5 });
  });

  it('should update duration when duration input changes', () => {
    render(<PropertyInspector />);
    
    const durationInput = screen.getByLabelText('Duration (s)');
    fireEvent.change(durationInput, { target: { value: '15.3' } });
    
    expect(mockUpdateClipProperties).toHaveBeenCalledWith('test-clip-1', { duration: 15.3 });
  });

  it('should update volume when volume input changes', () => {
    render(<PropertyInspector />);
    
    const volumeInput = screen.getByLabelText('Volume');
    fireEvent.change(volumeInput, { target: { value: '1.2' } });
    
    expect(mockUpdateClipProperties).toHaveBeenCalledWith('test-clip-1', { volume: 1.2 });
  });

  it('should show message when no clip is selected', () => {
    (useAetherStore as any).mockImplementation((selector: any) => {
      const state = {
        selectedClipId: null,
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        assetLibrary: [],
        updateClipProperties: mockUpdateClipProperties
      };
      
      return selector(state);
    });

    render(<PropertyInspector />);
    
    expect(screen.getByText('Select a clip to edit properties')).toBeInTheDocument();
  });

  it('should add Ken Burns animation when Add button is clicked', () => {
    render(<PropertyInspector />);
    
    // Get all Add buttons and find the one for Ken Burns Animation
    const addButtons = screen.getAllByText('Add');
    
    // The first Add button should be for Ken Burns Animation
    expect(addButtons).toHaveLength(2); // Ken Burns and Transition
    fireEvent.click(addButtons[0]);
    
    expect(mockUpdateClipProperties).toHaveBeenCalledWith('test-clip-1', {
      animation: {
        type: 'ken_burns',
        startRect: { x: 0, y: 0, scale: 1 },
        endRect: { x: 0, y: 0, scale: 1.2 }
      }
    });
  });
});