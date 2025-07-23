import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlaybackEngine } from '../usePlaybackEngine';
import { useAetherActions, useIsPlaying, useCurrentTime, useProjectSettings } from '../../store/useAetherStore';

// Mock the store hooks
vi.mock('../../store/useAetherStore', () => ({
  useIsPlaying: vi.fn(),
  useCurrentTime: vi.fn(),
  useProjectSettings: vi.fn(),
  useAetherActions: vi.fn(),
}));

describe('usePlaybackEngine', () => {
  const mockSetPlaying = vi.fn();
  const mockSetCurrentTime = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    (useCurrentTime as any).mockReturnValue(0);
    (useProjectSettings as any).mockReturnValue({
      name: 'Test Project',
      resolution: '1080p',
      fps: 30,
      duration: 60
    });
    (useAetherActions as any).mockReturnValue({
      setPlaying: mockSetPlaying,
      setCurrentTime: mockSetCurrentTime,
    });
  });

  it('should return correct interface with all required methods', () => {
    (useIsPlaying as any).mockReturnValue(false);

    const { result } = renderHook(() => usePlaybackEngine());

    expect(result.current).toHaveProperty('play');
    expect(result.current).toHaveProperty('pause');
    expect(result.current).toHaveProperty('stop');
    expect(result.current).toHaveProperty('togglePlayPause');
    expect(result.current).toHaveProperty('seek');
    expect(result.current).toHaveProperty('setPlaybackRate');
    expect(result.current).toHaveProperty('isPlaying');
    expect(result.current).toHaveProperty('currentTime');
    expect(result.current).toHaveProperty('duration');
    expect(result.current).toHaveProperty('playbackRate');
    
    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.pause).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.togglePlayPause).toBe('function');
    expect(typeof result.current.seek).toBe('function');
    expect(typeof result.current.setPlaybackRate).toBe('function');
    expect(typeof result.current.isPlaying).toBe('boolean');
    expect(typeof result.current.currentTime).toBe('number');
    expect(typeof result.current.duration).toBe('number');
    expect(typeof result.current.playbackRate).toBe('number');
  });

  it('should call setPlaying(true) when play is called', () => {
    (useIsPlaying as any).mockReturnValue(false);

    const { result } = renderHook(() => usePlaybackEngine());

    act(() => {
      result.current.play();
    });

    expect(mockSetPlaying).toHaveBeenCalledWith(true);
  });

  it('should call setPlaying(false) when pause is called', () => {
    (useIsPlaying as any).mockReturnValue(true);

    const { result } = renderHook(() => usePlaybackEngine());

    act(() => {
      result.current.pause();
    });

    expect(mockSetPlaying).toHaveBeenCalledWith(false);
  });

  it('should call setPlaying(false) and setCurrentTime(0) when stop is called', () => {
    (useIsPlaying as any).mockReturnValue(true);

    const { result } = renderHook(() => usePlaybackEngine());

    act(() => {
      result.current.stop();
    });

    expect(mockSetPlaying).toHaveBeenCalledWith(false);
    expect(mockSetCurrentTime).toHaveBeenCalledWith(0);
  });

  it('should toggle from playing to paused when togglePlayPause is called', () => {
    (useIsPlaying as any).mockReturnValue(true);

    const { result } = renderHook(() => usePlaybackEngine());

    act(() => {
      result.current.togglePlayPause();
    });

    expect(mockSetPlaying).toHaveBeenCalledWith(false);
  });

  it('should toggle from paused to playing when togglePlayPause is called', () => {
    (useIsPlaying as any).mockReturnValue(false);

    const { result } = renderHook(() => usePlaybackEngine());

    act(() => {
      result.current.togglePlayPause();
    });

    expect(mockSetPlaying).toHaveBeenCalledWith(true);
  });

  it('should return current playing state', () => {
    (useIsPlaying as any).mockReturnValue(true);

    const { result } = renderHook(() => usePlaybackEngine());

    expect(result.current.isPlaying).toBe(true);

    // Test with false state
    (useIsPlaying as any).mockReturnValue(false);
    const { result: result2 } = renderHook(() => usePlaybackEngine());

    expect(result2.current.isPlaying).toBe(false);
  });

  it('should memoize callbacks to prevent unnecessary re-renders', () => {
    (useIsPlaying as any).mockReturnValue(false);

    const { result, rerender } = renderHook(() => usePlaybackEngine());
    
    const initialPlay = result.current.play;
    const initialPause = result.current.pause;
    const initialStop = result.current.stop;
    const initialToggle = result.current.togglePlayPause;
    const initialSeek = result.current.seek;
    const initialSetPlaybackRate = result.current.setPlaybackRate;

    // Rerender without changing dependencies
    rerender();

    expect(result.current.play).toBe(initialPlay);
    expect(result.current.pause).toBe(initialPause);
    expect(result.current.stop).toBe(initialStop);
    expect(result.current.togglePlayPause).toBe(initialToggle);
    expect(result.current.seek).toBe(initialSeek);
    expect(result.current.setPlaybackRate).toBe(initialSetPlaybackRate);
  });

  it('should seek to specified time within project duration', () => {
    (useIsPlaying as any).mockReturnValue(false);

    const { result } = renderHook(() => usePlaybackEngine());

    act(() => {
      result.current.seek(30);
    });

    expect(mockSetCurrentTime).toHaveBeenCalledWith(30);
  });

  it('should clamp seek time to project bounds', () => {
    (useIsPlaying as any).mockReturnValue(false);

    const { result } = renderHook(() => usePlaybackEngine());

    // Test seeking beyond duration
    act(() => {
      result.current.seek(100);
    });

    expect(mockSetCurrentTime).toHaveBeenCalledWith(60); // Clamped to duration

    // Test seeking before start
    act(() => {
      result.current.seek(-10);
    });

    expect(mockSetCurrentTime).toHaveBeenCalledWith(0); // Clamped to 0
  });

  it('should return current time and duration from store', () => {
    (useIsPlaying as any).mockReturnValue(false);
    (useCurrentTime as any).mockReturnValue(25);

    const { result } = renderHook(() => usePlaybackEngine());

    expect(result.current.currentTime).toBe(25);
    expect(result.current.duration).toBe(60);
  });

  it('should initialize with default playback rate', () => {
    (useIsPlaying as any).mockReturnValue(false);

    const { result } = renderHook(() => usePlaybackEngine());

    expect(result.current.playbackRate).toBe(1);
  });

  it('should set playback rate within valid range', () => {
    (useIsPlaying as any).mockReturnValue(false);

    const { result } = renderHook(() => usePlaybackEngine());

    act(() => {
      result.current.setPlaybackRate(2);
    });

    expect(result.current.playbackRate).toBe(2);

    // Test clamping to maximum
    act(() => {
      result.current.setPlaybackRate(10);
    });

    expect(result.current.playbackRate).toBe(4); // Clamped to max

    // Test clamping to minimum
    act(() => {
      result.current.setPlaybackRate(0.1);
    });

    expect(result.current.playbackRate).toBe(0.25); // Clamped to min
  });
});