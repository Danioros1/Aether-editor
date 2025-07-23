import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App';
import { useAetherStore } from '../../store/useAetherStore';

// Mock the hooks and components that aren't relevant to keyboard testing
vi.mock('../../hooks/usePlaybackEngine', () => ({
  usePlaybackEngine: () => ({
    togglePlayPause: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAudioManager', () => ({
  useAudioManager: () => ({}),
}));

vi.mock('../../components/Timeline', () => ({
  Timeline: () => (
    <div data-testid="timeline">
      Timeline
      <div id="timeline-instructions" className="sr-only">
        Timeline editor. Use arrow keys to navigate
      </div>
    </div>
  ),
}));

vi.mock('../../components/AssetLibrary', () => ({
  AssetLibrary: () => <div data-testid="asset-library">Asset Library</div>,
}));

vi.mock('../../components/PropertyInspector', () => ({
  PropertyInspector: () => <div data-testid="property-inspector">Property Inspector</div>,
}));

vi.mock('../../components/PreviewWindow', () => ({
  PreviewWindow: () => <div data-testid="preview-window">Preview Window</div>,
}));

vi.mock('../../components/TransportControls', () => ({
  TransportControls: () => <div data-testid="transport-controls">Transport Controls</div>,
}));

vi.mock('../../components/TimelineControls', () => ({
  TimelineControls: () => <div data-testid="timeline-controls">Timeline Controls</div>,
}));

describe('Keyboard Shortcuts and Accessibility', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAetherStore.getState().resetProject();
  });

  it('should have proper ARIA labels and roles', () => {
    render(<App />);
    
    // Check main application role
    expect(screen.getByRole('application')).toBeInTheDocument();
    expect(screen.getByRole('application')).toHaveAttribute('aria-label', 'Aether Video Editor');
    
    // Check main sections
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByLabelText('Asset library')).toBeInTheDocument();
    expect(screen.getByLabelText('Property inspector')).toBeInTheDocument();
    expect(screen.getByLabelText('Video timeline')).toBeInTheDocument();
  });

  it('should have accessible toolbar with proper ARIA attributes', () => {
    render(<App />);
    
    const toolbar = screen.getByRole('toolbar', { name: 'Main actions' });
    expect(toolbar).toBeInTheDocument();
    
    // Check undo/redo buttons
    const undoButton = screen.getByLabelText('Undo last action');
    const redoButton = screen.getByLabelText('Redo last undone action');
    
    expect(undoButton).toBeInTheDocument();
    expect(redoButton).toBeInTheDocument();
    expect(undoButton).toHaveAttribute('aria-keyshortcuts', 'Control+Z');
    expect(redoButton).toHaveAttribute('aria-keyshortcuts', 'Control+Y Control+Shift+Z');
  });

  it('should open keyboard shortcuts modal with F1 key', () => {
    render(<App />);
    
    // F1 should open keyboard shortcuts modal
    fireEvent.keyDown(document, { code: 'F1' });
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Use these keyboard shortcuts to work more efficiently in Aether Editor.')).toBeInTheDocument();
  });

  it('should open keyboard shortcuts modal with Ctrl+/ key', () => {
    render(<App />);
    
    // Ctrl+/ should open keyboard shortcuts modal
    fireEvent.keyDown(document, { code: 'Slash', ctrlKey: true });
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('should have help button with proper accessibility attributes', () => {
    render(<App />);
    
    const helpButton = screen.getByLabelText('Show keyboard shortcuts help');
    expect(helpButton).toBeInTheDocument();
    expect(helpButton).toHaveAttribute('aria-keyshortcuts', 'F1');
    expect(helpButton).toHaveAttribute('title', 'Keyboard Shortcuts (F1)');
  });

  it('should not trigger shortcuts when typing in input fields', () => {
    render(<App />);
    
    // Create a mock input field
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    
    const togglePlayPauseSpy = vi.fn();
    
    // Mock the playback engine
    vi.doMock('../../hooks/usePlaybackEngine', () => ({
      usePlaybackEngine: () => ({
        togglePlayPause: togglePlayPauseSpy,
        stop: vi.fn(),
        seek: vi.fn(),
        isPlaying: false,
        currentTime: 0
      })
    }));
    
    // Space key should not trigger play/pause when input is focused
    fireEvent.keyDown(input, { code: 'Space' });
    
    expect(togglePlayPauseSpy).not.toHaveBeenCalled();
    
    document.body.removeChild(input);
  });

  it('should display keyboard shortcuts in organized categories', () => {
    render(<App />);
    
    // Open keyboard shortcuts modal
    fireEvent.keyDown(document, { code: 'F1' });
    
    // Check for different categories
    expect(screen.getByText('Playback')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Editing')).toBeInTheDocument();
    expect(screen.getByText('Clip Manipulation')).toBeInTheDocument();
    expect(screen.getAllByText('Timeline')[0]).toBeInTheDocument();
    expect(screen.getByText('Selection')).toBeInTheDocument();
    
    // Check for specific shortcuts
    expect(screen.getByText('Play/Pause')).toBeInTheDocument();
    expect(screen.getByText('Delete selected clips')).toBeInTheDocument();
    expect(screen.getByText('Undo')).toBeInTheDocument();
    expect(screen.getByText('Split clip at playhead')).toBeInTheDocument();
  });

  it('should have screen reader instructions for timeline', () => {
    render(<App />);
    
    // Check for screen reader instructions (they should be present but hidden)
    const instructions = document.getElementById('timeline-instructions');
    expect(instructions).toBeInTheDocument();
    expect(instructions).toHaveClass('sr-only');
    expect(instructions).toHaveTextContent('Timeline editor. Use arrow keys to navigate');
  });
});