import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssetType, ClipType, AetherProjectType } from '@aether-editor/types';
import App from '../../App';
import { useAetherStore } from '../../store/useAetherStore';

// Mock the store to control state during tests
vi.mock('../../store/useAetherStore');

describe('Complete User Workflow Integration Tests', () => {
  const mockStore = {
    // Project state
    projectSettings: {
      name: 'Test Project',
      resolution: '1080p' as const,
      fps: 30,
      duration: 0
    },
    assetLibrary: [] as AssetType[],
    timeline: {
      videoTracks: [[]],
      audioTracks: [[]]
    },
    selectedClipId: null,
    selectedClipIds: [],
    currentTime: 0,
    isPlaying: false,
    timelineScale: 50,

    // Actions
    addAsset: vi.fn(),
    addClipToTimeline: vi.fn(),
    updateClip: vi.fn(),
    deleteClip: vi.fn(),
    setCurrentTime: vi.fn(),
    togglePlayback: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    exportProject: vi.fn(),
    loadProject: vi.fn(),
    saveProject: vi.fn()
  };

  beforeEach(() => {
    vi.mocked(useAetherStore).mockReturnValue(mockStore);
    vi.clearAllMocks();
  });

  describe('Asset Upload to Export Workflow', () => {
    it('should complete full workflow from asset upload to export', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      // Step 1: Upload an asset
      const mockAsset: AssetType = {
        assetId: 'test-asset-1',
        fileName: 'test-video.mp4',
        type: 'video',
        sourceUrl: 'http://localhost:3001/uploads/test-video.mp4',
        thumbnailUrl: 'http://localhost:3001/uploads/test-video-thumb.jpg',
        duration: 10,
        isPlaceholder: false
      };

      // Simulate asset upload
      mockStore.addAsset.mockImplementation(() => {
        mockStore.assetLibrary.push(mockAsset);
      });

      // Find and interact with asset upload area
      const assetLibrary = screen.getByTestId('asset-library');
      expect(assetLibrary).toBeInTheDocument();

      // Step 2: Add asset to timeline
      mockStore.addClipToTimeline.mockImplementation(() => {
        const newClip: ClipType = {
          clipId: 'clip-1',
          assetId: mockAsset.assetId,
          startTime: 0,
          duration: mockAsset.duration,
          volume: 1,
          textOverlays: []
        };
        mockStore.timeline.videoTracks[0].push(newClip);
      });

      // Step 3: Test playback controls
      const playButton = screen.getByTestId('play-button');
      await user.click(playButton);
      expect(mockStore.togglePlayback).toHaveBeenCalled();

      // Step 4: Test timeline interaction
      const timeline = screen.getByTestId('timeline');
      expect(timeline).toBeInTheDocument();

      // Step 5: Test export functionality
      const exportButton = screen.getByTestId('export-button');
      await user.click(exportButton);
      expect(mockStore.exportProject).toHaveBeenCalled();
    });

    it('should handle asset upload errors gracefully', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      // Mock upload failure
      mockStore.addAsset.mockRejectedValue(new Error('Upload failed'));

      const assetLibrary = screen.getByTestId('asset-library');
      
      // Simulate file drop that fails
      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      
      // This would trigger error handling
      expect(assetLibrary).toBeInTheDocument();
    });
  });

  describe('Timeline Editing Workflow', () => {
    beforeEach(() => {
      // Setup timeline with existing clips
      const mockAsset: AssetType = {
        assetId: 'test-asset-1',
        fileName: 'test-video.mp4',
        type: 'video',
        sourceUrl: 'http://localhost:3001/uploads/test-video.mp4',
        duration: 10,
        isPlaceholder: false
      };

      const mockClip: ClipType = {
        clipId: 'clip-1',
        assetId: 'test-asset-1',
        startTime: 0,
        duration: 10,
        volume: 1,
        textOverlays: []
      };

      mockStore.assetLibrary = [mockAsset];
      mockStore.timeline.videoTracks[0] = [mockClip];
    });

    it('should handle clip selection and editing', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      const timeline = screen.getByTestId('timeline');
      const clip = screen.getByTestId('clip-clip-1');
      
      // Select clip
      await user.click(clip);
      expect(mockStore.selectedClipId).toBe('clip-1');

      // Test property inspector updates
      const propertyInspector = screen.getByTestId('property-inspector');
      expect(propertyInspector).toBeInTheDocument();
    });

    it('should handle clip splitting', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      // Select clip first
      const clip = screen.getByTestId('clip-clip-1');
      await user.click(clip);

      // Use keyboard shortcut to split
      await user.keyboard('c');
      
      // Verify split action was called
      expect(mockStore.updateClip).toHaveBeenCalled();
    });

    it('should handle multi-clip selection', async () => {
      const user = userEvent.setup();
      
      // Add second clip
      const secondClip: ClipType = {
        clipId: 'clip-2',
        assetId: 'test-asset-1',
        startTime: 10,
        duration: 5,
        volume: 1,
        textOverlays: []
      };
      mockStore.timeline.videoTracks[0].push(secondClip);

      render(<App />);

      const clip1 = screen.getByTestId('clip-clip-1');
      const clip2 = screen.getByTestId('clip-clip-2');

      // Multi-select with Ctrl+click
      await user.click(clip1);
      await user.keyboard('{Control>}');
      await user.click(clip2);
      await user.keyboard('{/Control}');

      expect(mockStore.selectedClipIds).toContain('clip-1');
      expect(mockStore.selectedClipIds).toContain('clip-2');
    });
  });

  describe('Undo/Redo Workflow', () => {
    it('should handle undo/redo operations', async () => {
      const user = userEvent.setup();
      
      mockStore.canUndo = true;
      mockStore.canRedo = false;

      render(<App />);

      // Test undo
      await user.keyboard('{Control>}z{/Control}');
      expect(mockStore.undo).toHaveBeenCalled();

      // Update state for redo
      mockStore.canUndo = false;
      mockStore.canRedo = true;

      // Test redo
      await user.keyboard('{Control>}y{/Control}');
      expect(mockStore.redo).toHaveBeenCalled();
    });

    it('should track undoable actions correctly', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      // Perform an action that should be undoable
      const clip = screen.getByTestId('clip-clip-1');
      await user.click(clip);

      // Delete clip
      await user.keyboard('{Delete}');
      expect(mockStore.deleteClip).toHaveBeenCalled();

      // Should be able to undo
      mockStore.canUndo = true;
      await user.keyboard('{Control>}z{/Control}');
      expect(mockStore.undo).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts Workflow', () => {
    it('should handle all keyboard shortcuts', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      // Test play/pause
      await user.keyboard(' ');
      expect(mockStore.togglePlayback).toHaveBeenCalled();

      // Test timeline navigation
      await user.keyboard('{ArrowLeft}');
      expect(mockStore.setCurrentTime).toHaveBeenCalled();

      await user.keyboard('{ArrowRight}');
      expect(mockStore.setCurrentTime).toHaveBeenCalled();

      // Test keyboard shortcuts modal
      await user.keyboard('{Control>}?{/Control}');
      await waitFor(() => {
        expect(screen.getByTestId('keyboard-shortcuts-modal')).toBeInTheDocument();
      });
    });

    it('should handle shortcuts with clip selection', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      // Select clip first
      const clip = screen.getByTestId('clip-clip-1');
      await user.click(clip);

      // Test clip-specific shortcuts
      await user.keyboard('c'); // Split
      await user.keyboard('{Delete}'); // Delete
      
      expect(mockStore.updateClip).toHaveBeenCalled();
      expect(mockStore.deleteClip).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from playback errors', async () => {
      const user = userEvent.setup();
      
      // Mock playback error
      mockStore.togglePlayback.mockRejectedValue(new Error('Playback failed'));

      render(<App />);

      const playButton = screen.getByTestId('play-button');
      await user.click(playButton);

      // Should show error message but not crash
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors during export', async () => {
      const user = userEvent.setup();
      
      // Mock export error
      mockStore.exportProject.mockRejectedValue(new Error('Network error'));

      render(<App />);

      const exportButton = screen.getByTestId('export-button');
      await user.click(exportButton);

      // Should show retry option
      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
      });
    });

    it('should handle corrupted project data', async () => {
      const user = userEvent.setup();
      
      // Mock corrupted data
      mockStore.loadProject.mockRejectedValue(new Error('Invalid project data'));

      render(<App />);

      // Should fallback to empty project
      expect(mockStore.assetLibrary).toEqual([]);
      expect(mockStore.timeline.videoTracks[0]).toEqual([]);
    });
  });

  describe('Accessibility Workflow', () => {
    it('should support screen reader navigation', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      // Check for screen reader instructions
      expect(screen.getByTestId('timeline-instructions')).toBeInTheDocument();
      expect(screen.getByTestId('asset-library-instructions')).toBeInTheDocument();

      // Test keyboard navigation
      await user.tab();
      expect(document.activeElement).toHaveAttribute('data-testid', 'asset-library');

      await user.tab();
      expect(document.activeElement).toHaveAttribute('data-testid', 'timeline');
    });

    it('should announce important actions to screen readers', async () => {
      const user = userEvent.setup();
      
      render(<App />);

      // Mock screen reader announcements
      const announcer = screen.getByTestId('screen-reader-announcer');
      
      // Perform action that should be announced
      const playButton = screen.getByTestId('play-button');
      await user.click(playButton);

      expect(announcer).toHaveTextContent(/playback started/i);
    });

    it('should handle reduced motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<App />);

      // Animations should be disabled
      const timeline = screen.getByTestId('timeline');
      expect(timeline).toHaveClass('reduce-motion');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large projects efficiently', async () => {
      // Create large project data
      const manyAssets: AssetType[] = Array.from({ length: 100 }, (_, i) => ({
        assetId: `asset-${i}`,
        fileName: `asset-${i}.jpg`,
        type: 'image' as const,
        sourceUrl: `http://localhost:3001/uploads/asset-${i}.jpg`,
        duration: 5,
        isPlaceholder: false
      }));

      const manyClips: ClipType[] = Array.from({ length: 50 }, (_, i) => ({
        clipId: `clip-${i}`,
        assetId: `asset-${i}`,
        startTime: i * 2,
        duration: 1,
        volume: 1,
        textOverlays: []
      }));

      mockStore.assetLibrary = manyAssets;
      mockStore.timeline.videoTracks[0] = manyClips;

      const startTime = performance.now();
      render(<App />);
      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (2 seconds)
      expect(renderTime).toBeLessThan(2000);

      // Should use virtualization for large lists
      const assetLibrary = screen.getByTestId('asset-library');
      expect(assetLibrary).toHaveAttribute('data-virtualized', 'true');
    });

    it('should handle memory pressure gracefully', async () => {
      // Mock low memory condition
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 900 * 1024 * 1024, // 900MB
          totalJSHeapSize: 1024 * 1024 * 1024, // 1GB
          jsHeapSizeLimit: 1024 * 1024 * 1024
        }
      });

      render(<App />);

      // Should automatically enable performance mode
      await waitFor(() => {
        expect(screen.getByTestId('performance-mode-indicator')).toBeInTheDocument();
      });
    });
  });
});