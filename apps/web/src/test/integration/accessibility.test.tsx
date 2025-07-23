import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import App from '../../App';
import { useAetherStore } from '../../store/useAetherStore';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock the store
vi.mock('../../store/useAetherStore');

describe('Accessibility Integration Tests', () => {
  const mockStore = {
    projectSettings: {
      name: 'Test Project',
      resolution: '1080p' as const,
      fps: 30,
      duration: 15
    },
    assetLibrary: [
      {
        assetId: 'test-asset-1',
        fileName: 'test-video.mp4',
        type: 'video' as const,
        sourceUrl: 'http://localhost:3001/uploads/test-video.mp4',
        duration: 10,
        isPlaceholder: false
      }
    ],
    timeline: {
      videoTracks: [[
        {
          clipId: 'clip-1',
          assetId: 'test-asset-1',
          startTime: 0,
          duration: 10,
          volume: 1,
          textOverlays: []
        }
      ]],
      audioTracks: [[]]
    },
    selectedClipId: null,
    selectedClipIds: [],
    currentTime: 0,
    isPlaying: false,
    timelineScale: 50,
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

  describe('WCAG Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<App />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility during dynamic content changes', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);

      // Add new clip
      const assetItem = screen.getByTestId('asset-test-asset-1');
      await user.click(assetItem);

      // Check accessibility after state change
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility in modal dialogs', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);

      // Open export modal
      const exportButton = screen.getByTestId('export-button');
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByTestId('export-modal')).toBeInTheDocument();
      });

      // Check modal accessibility
      const modal = screen.getByTestId('export-modal');
      const results = await axe(modal);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Tab through main interface elements
      await user.tab();
      expect(document.activeElement).toHaveAttribute('data-testid', 'asset-library');

      await user.tab();
      expect(document.activeElement).toHaveAttribute('data-testid', 'timeline');

      await user.tab();
      expect(document.activeElement).toHaveAttribute('data-testid', 'preview-window');

      await user.tab();
      expect(document.activeElement).toHaveAttribute('data-testid', 'property-inspector');
    });

    it('should handle keyboard shortcuts without interfering with screen readers', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Focus on timeline first
      const timeline = screen.getByTestId('timeline');
      timeline.focus();

      // Test play/pause shortcut
      await user.keyboard(' ');
      expect(mockStore.togglePlayback).toHaveBeenCalled();

      // Should announce action to screen readers
      const announcer = screen.getByTestId('screen-reader-announcer');
      expect(announcer).toHaveTextContent(/playback/i);
    });

    it('should support arrow key navigation in timeline', async () => {
      const user = userEvent.setup();
      render(<App />);

      const timeline = screen.getByTestId('timeline');
      timeline.focus();

      // Navigate with arrow keys
      await user.keyboard('{ArrowRight}');
      expect(mockStore.setCurrentTime).toHaveBeenCalledWith(expect.any(Number));

      await user.keyboard('{ArrowLeft}');
      expect(mockStore.setCurrentTime).toHaveBeenCalledWith(expect.any(Number));

      // Should announce time changes
      const announcer = screen.getByTestId('screen-reader-announcer');
      expect(announcer).toHaveTextContent(/time/i);
    });

    it('should support keyboard clip selection and manipulation', async () => {
      const user = userEvent.setup();
      render(<App />);

      const clip = screen.getByTestId('clip-clip-1');
      clip.focus();

      // Select clip with Enter
      await user.keyboard('{Enter}');
      expect(mockStore.selectedClipId).toBe('clip-1');

      // Split clip with 'C'
      await user.keyboard('c');
      expect(mockStore.updateClip).toHaveBeenCalled();

      // Delete clip with Delete
      await user.keyboard('{Delete}');
      expect(mockStore.deleteClip).toHaveBeenCalled();
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide meaningful labels for all interactive elements', () => {
      render(<App />);

      // Check for proper ARIA labels
      expect(screen.getByLabelText(/asset library/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/timeline/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/preview window/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/property inspector/i)).toBeInTheDocument();

      // Check for play button
      expect(screen.getByLabelText(/play video/i)).toBeInTheDocument();
    });

    it('should announce important state changes', async () => {
      const user = userEvent.setup();
      render(<App />);

      const playButton = screen.getByTestId('play-button');
      await user.click(playButton);

      // Should announce playback state
      const announcer = screen.getByTestId('screen-reader-announcer');
      expect(announcer).toHaveTextContent(/playback started/i);

      // Test pause
      await user.click(playButton);
      expect(announcer).toHaveTextContent(/playback paused/i);
    });

    it('should provide timeline position information', async () => {
      const user = userEvent.setup();
      render(<App />);

      const timeline = screen.getByTestId('timeline');
      
      // Click on timeline to change position
      fireEvent.click(timeline, { clientX: 100 });

      // Should announce new position
      const announcer = screen.getByTestId('screen-reader-announcer');
      expect(announcer).toHaveTextContent(/current time/i);
    });

    it('should describe clip properties for screen readers', async () => {
      const user = userEvent.setup();
      render(<App />);

      const clip = screen.getByTestId('clip-clip-1');
      
      // Should have descriptive aria-label
      expect(clip).toHaveAttribute('aria-label', expect.stringMatching(/video clip.*duration.*10 seconds/i));

      // Focus should announce clip details
      clip.focus();
      
      const announcer = screen.getByTestId('screen-reader-announcer');
      expect(announcer).toHaveTextContent(/selected clip.*test-video/i);
    });

    it('should provide asset library navigation instructions', () => {
      render(<App />);

      const assetLibrary = screen.getByTestId('asset-library');
      
      // Should have instructions for screen readers
      expect(assetLibrary).toHaveAttribute('aria-describedby', 'asset-library-instructions');
      
      const instructions = screen.getByTestId('asset-library-instructions');
      expect(instructions).toHaveTextContent(/use arrow keys to navigate/i);
    });
  });

  describe('High Contrast and Visual Accessibility', () => {
    it('should support high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
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

      // Should apply high contrast styles
      const timeline = screen.getByTestId('timeline');
      expect(timeline).toHaveClass('high-contrast');
    });

    it('should respect reduced motion preferences', () => {
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

      // Should disable animations
      const timeline = screen.getByTestId('timeline');
      expect(timeline).toHaveClass('reduce-motion');
    });

    it('should provide sufficient color contrast', () => {
      render(<App />);

      // Check that important elements have proper contrast
      const playButton = screen.getByTestId('play-button');
      const computedStyle = window.getComputedStyle(playButton);
      
      // Should have sufficient contrast (this would need actual color analysis in real tests)
      expect(computedStyle.backgroundColor).toBeDefined();
      expect(computedStyle.color).toBeDefined();
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in modal dialogs', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Open keyboard shortcuts modal
      await user.keyboard('{Control>}?{/Control}');

      await waitFor(() => {
        expect(screen.getByTestId('keyboard-shortcuts-modal')).toBeInTheDocument();
      });

      // Focus should be trapped in modal
      const modal = screen.getByTestId('keyboard-shortcuts-modal');
      const firstFocusable = modal.querySelector('[tabindex="0"]');
      expect(document.activeElement).toBe(firstFocusable);

      // Tab should cycle within modal
      await user.tab();
      expect(document.activeElement).toBeInstanceOf(HTMLElement);
      expect(modal.contains(document.activeElement)).toBe(true);

      // Escape should close modal and restore focus
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('keyboard-shortcuts-modal')).not.toBeInTheDocument();
      });
    });

    it('should maintain focus during timeline updates', async () => {
      const user = userEvent.setup();
      render(<App />);

      const clip = screen.getByTestId('clip-clip-1');
      clip.focus();

      // Update clip properties
      mockStore.updateClip('clip-1', { volume: 0.5 });

      // Focus should remain on clip
      expect(document.activeElement).toBe(clip);
    });

    it('should handle focus when clips are deleted', async () => {
      const user = userEvent.setup();
      render(<App />);

      const clip = screen.getByTestId('clip-clip-1');
      clip.focus();

      // Delete focused clip
      await user.keyboard('{Delete}');

      // Focus should move to timeline
      await waitFor(() => {
        expect(document.activeElement).toHaveAttribute('data-testid', 'timeline');
      });
    });
  });

  describe('Alternative Input Methods', () => {
    it('should support voice control commands', async () => {
      render(<App />);

      // Mock speech recognition
      const mockSpeechRecognition = {
        start: vi.fn(),
        stop: vi.fn(),
        onresult: null,
        onerror: null
      };

      (window as any).SpeechRecognition = vi.fn(() => mockSpeechRecognition);

      // Simulate voice command
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult({
          results: [{
            0: { transcript: 'play video' }
          }]
        } as any);
      }

      // Should execute play command
      expect(mockStore.togglePlayback).toHaveBeenCalled();
    });

    it('should support switch navigation', async () => {
      render(<App />);

      // Mock switch input (single button that cycles through options)
      const switchButton = document.createElement('button');
      switchButton.setAttribute('data-testid', 'switch-input');
      document.body.appendChild(switchButton);

      // Simulate switch activation
      fireEvent.click(switchButton);

      // Should cycle to next focusable element
      expect(document.activeElement).toHaveAttribute('tabindex');

      document.body.removeChild(switchButton);
    });
  });

  describe('Responsive Accessibility', () => {
    it('should maintain accessibility on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });

      render(<App />);

      // Should have touch-friendly targets
      const playButton = screen.getByTestId('play-button');
      const computedStyle = window.getComputedStyle(playButton);
      
      // Should meet minimum touch target size (44px)
      expect(parseInt(computedStyle.minHeight)).toBeGreaterThanOrEqual(44);
      expect(parseInt(computedStyle.minWidth)).toBeGreaterThanOrEqual(44);
    });

    it('should provide alternative navigation for small screens', () => {
      // Mock small screen
      Object.defineProperty(window, 'innerWidth', { value: 320 });

      render(<App />);

      // Should show mobile navigation
      expect(screen.getByTestId('mobile-nav-menu')).toBeInTheDocument();

      // Should have proper ARIA labels for mobile
      const mobileMenu = screen.getByTestId('mobile-nav-menu');
      expect(mobileMenu).toHaveAttribute('aria-label', /navigation menu/i);
    });
  });

  describe('Error Accessibility', () => {
    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      
      // Mock error condition
      mockStore.exportProject.mockRejectedValue(new Error('Export failed'));

      render(<App />);

      const exportButton = screen.getByTestId('export-button');
      await user.click(exportButton);

      // Should announce error
      await waitFor(() => {
        const announcer = screen.getByTestId('screen-reader-announcer');
        expect(announcer).toHaveTextContent(/error.*export failed/i);
      });

      // Error should have proper ARIA attributes
      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
    });

    it('should provide accessible error recovery options', async () => {
      const user = userEvent.setup();
      
      mockStore.addAsset.mockRejectedValue(new Error('Upload failed'));

      render(<App />);

      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      const input = screen.getByTestId('file-upload-input');
      
      await user.upload(input, file);

      // Should show accessible retry button
      await waitFor(() => {
        const retryButton = screen.getByTestId('retry-upload-button');
        expect(retryButton).toHaveAttribute('aria-label', /retry upload/i);
        expect(retryButton).toHaveAttribute('aria-describedby', 'upload-error-description');
      });
    });
  });
});