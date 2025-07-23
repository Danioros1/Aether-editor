import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAudioManager } from '../useAudioManager';

// Mock the store hooks
vi.mock('../../store/useAetherStore', () => ({
  useCurrentTime: vi.fn(() => 0),
  useIsPlaying: vi.fn(() => false),
  useTimeline: vi.fn(() => ({
    videoTracks: [[]],
    audioTracks: [[]]
  })),
  useAssetLibrary: vi.fn(() => []),
}));

// Mock console methods
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('useAudioManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  it('should return audio manager interface', () => {
    const { result } = renderHook(() => useAudioManager());

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe('object');
    expect(typeof result.current.syncAudioTracks).toBe('function');
    expect(typeof result.current.setVolume).toBe('function');
    expect(typeof result.current.muteTrack).toBe('function');
    expect(typeof result.current.getAudioContext).toBe('function');
    expect(typeof result.current.isAudioAvailable).toBe('boolean');
    expect(typeof result.current.activeAudioTracks).toBe('number');
  });

  it('should handle missing AudioContext gracefully', () => {
    // Mock window without AudioContext
    const originalWindow = global.window;
    global.window = {} as any;

    const { result } = renderHook(() => useAudioManager());

    expect(result.current).toBeDefined();
    expect(result.current.getAudioContext()).toBeNull();
    
    // Restore window
    global.window = originalWindow;
  });

  it('should handle AudioContext initialization failure gracefully', () => {
    // Mock AudioContext to throw an error
    const originalWindow = global.window;
    global.window = {
      AudioContext: vi.fn(() => {
        throw new Error('AudioContext not supported');
      })
    } as any;

    const { result } = renderHook(() => useAudioManager());

    expect(result.current).toBeDefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'AudioContext initialization failed:',
      expect.any(Error)
    );
    
    // Restore window
    global.window = originalWindow;
  });

  it('should be a valid hook that can be called', () => {
    // This test just verifies the hook can be called without crashing
    expect(() => renderHook(() => useAudioManager())).not.toThrow();
  });
});