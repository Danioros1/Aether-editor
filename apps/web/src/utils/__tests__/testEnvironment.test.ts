import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isTestEnvironment,
  isAPIAvailable,
  createMockMatchMedia,
  createMockPerformanceMemory,
  createMockAudioContext,
  setupBrowserAPIMocks,
  getAPIFallback,
  safeAPICall
} from '../testEnvironment';

describe('Test Environment Utility', () => {
  describe('isTestEnvironment', () => {
    it('should detect test environment correctly', () => {
      expect(isTestEnvironment()).toBe(true);
    });
  });

  describe('isAPIAvailable', () => {
    it('should detect matchMedia availability', () => {
      const result = isAPIAvailable('matchMedia');
      expect(typeof result).toBe('boolean');
    });

    it('should detect performance.memory availability', () => {
      const result = isAPIAvailable('performance.memory');
      expect(typeof result).toBe('boolean');
    });

    it('should detect AudioContext availability', () => {
      const result = isAPIAvailable('AudioContext');
      expect(typeof result).toBe('boolean');
    });

    it('should return false for unknown APIs', () => {
      expect(isAPIAvailable('unknownAPI')).toBe(false);
    });
  });

  describe('createMockMatchMedia', () => {
    it('should create a functional mock matchMedia', () => {
      const mockMatchMedia = createMockMatchMedia();
      const mediaQuery = mockMatchMedia('(max-width: 768px)');

      expect(mediaQuery).toHaveProperty('matches');
      expect(mediaQuery).toHaveProperty('media');
      expect(mediaQuery).toHaveProperty('addListener');
      expect(mediaQuery).toHaveProperty('removeListener');
      expect(mediaQuery).toHaveProperty('addEventListener');
      expect(mediaQuery).toHaveProperty('removeEventListener');
    });

    it('should handle prefers-color-scheme queries', () => {
      const mockMatchMedia = createMockMatchMedia();
      const darkQuery = mockMatchMedia('(prefers-color-scheme: dark)');
      
      expect(darkQuery.matches).toBe(false); // Default to light theme
      expect(darkQuery.media).toBe('(prefers-color-scheme: dark)');
    });

    it('should handle prefers-reduced-motion queries', () => {
      const mockMatchMedia = createMockMatchMedia();
      const motionQuery = mockMatchMedia('(prefers-reduced-motion: reduce)');
      
      expect(motionQuery.matches).toBe(false); // Default to no reduced motion
      expect(motionQuery.media).toBe('(prefers-reduced-motion: reduce)');
    });

    it('should handle responsive queries', () => {
      const mockMatchMedia = createMockMatchMedia();
      const mobileQuery = mockMatchMedia('(max-width: 768px)');
      const desktopQuery = mockMatchMedia('(min-width: 1200px)');
      
      expect(typeof mobileQuery.matches).toBe('boolean');
      expect(typeof desktopQuery.matches).toBe('boolean');
    });

    it('should support event listeners', () => {
      const mockMatchMedia = createMockMatchMedia();
      const mediaQuery = mockMatchMedia('(max-width: 768px)');
      
      const listener = vi.fn();
      mediaQuery.addListener(listener);
      
      // Simulate a change event
      const event = new Event('change') as any;
      mediaQuery.dispatchEvent(event);
      
      expect(listener).toHaveBeenCalledWith(event);
    });
  });

  describe('createMockPerformanceMemory', () => {
    it('should create a mock performance memory object', () => {
      const mockMemory = createMockPerformanceMemory();

      expect(mockMemory).toHaveProperty('usedJSHeapSize');
      expect(mockMemory).toHaveProperty('totalJSHeapSize');
      expect(mockMemory).toHaveProperty('jsHeapSizeLimit');
      
      expect(typeof mockMemory.usedJSHeapSize).toBe('number');
      expect(typeof mockMemory.totalJSHeapSize).toBe('number');
      expect(typeof mockMemory.jsHeapSizeLimit).toBe('number');
      
      expect(mockMemory.usedJSHeapSize).toBeGreaterThan(0);
      expect(mockMemory.totalJSHeapSize).toBeGreaterThan(mockMemory.usedJSHeapSize);
      expect(mockMemory.jsHeapSizeLimit).toBeGreaterThan(mockMemory.totalJSHeapSize);
    });
  });

  describe('createMockAudioContext', () => {
    it('should create a mock AudioContext', () => {
      const mockAudioContext = createMockAudioContext();

      expect(mockAudioContext).toHaveProperty('state');
      expect(mockAudioContext).toHaveProperty('sampleRate');
      expect(mockAudioContext).toHaveProperty('currentTime');
      expect(mockAudioContext).toHaveProperty('close');
      expect(mockAudioContext).toHaveProperty('resume');
      expect(mockAudioContext).toHaveProperty('suspend');
      expect(mockAudioContext).toHaveProperty('createBuffer');
      expect(mockAudioContext).toHaveProperty('createBufferSource');
      expect(mockAudioContext).toHaveProperty('createGain');
    });

    it('should have functional methods', async () => {
      const mockAudioContext = createMockAudioContext();

      expect(typeof mockAudioContext.close).toBe('function');
      expect(typeof mockAudioContext.resume).toBe('function');
      expect(typeof mockAudioContext.suspend).toBe('function');
      
      // Test async methods don't throw
      await expect(mockAudioContext.close!()).resolves.toBeUndefined();
      await expect(mockAudioContext.resume!()).resolves.toBeUndefined();
      await expect(mockAudioContext.suspend!()).resolves.toBeUndefined();
    });

    it('should create mock audio nodes', () => {
      const mockAudioContext = createMockAudioContext();

      const buffer = mockAudioContext.createBuffer!(2, 1024, 44100);
      expect(buffer).toHaveProperty('numberOfChannels', 2);
      expect(buffer).toHaveProperty('length', 1024);
      expect(buffer).toHaveProperty('sampleRate', 44100);

      const source = mockAudioContext.createBufferSource!();
      expect(source).toHaveProperty('connect');
      expect(source).toHaveProperty('start');

      const gain = mockAudioContext.createGain!();
      expect(gain).toHaveProperty('gain');
      expect(gain).toHaveProperty('connect');
    });
  });

  describe('setupBrowserAPIMocks', () => {
    let originalMatchMedia: typeof window.matchMedia;
    let originalPerformanceMemory: any;

    beforeEach(() => {
      // Store original implementations
      originalMatchMedia = window.matchMedia;
      originalPerformanceMemory = (performance as any).memory;
    });

    afterEach(() => {
      // Restore original implementations
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: originalMatchMedia
        });
      }
      if (originalPerformanceMemory) {
        Object.defineProperty(performance, 'memory', {
          writable: true,
          value: originalPerformanceMemory
        });
      }
    });

    it('should setup mocks in test environment', () => {
      // Test that setupBrowserAPIMocks doesn't throw errors
      expect(() => setupBrowserAPIMocks()).not.toThrow();

      // Verify that APIs are available after setup
      expect(window.matchMedia).toBeDefined();
      expect((performance as any).memory).toBeDefined();
    });

    it('should not override existing implementations', () => {
      const customMatchMedia = vi.fn();
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: customMatchMedia
      });

      setupBrowserAPIMocks();

      expect(window.matchMedia).toBe(customMatchMedia);
    });
  });

  describe('getAPIFallback', () => {
    it('should return appropriate fallbacks', () => {
      const matchMediaFallback = getAPIFallback('matchMedia');
      expect(typeof matchMediaFallback).toBe('function');

      const memoryFallback = getAPIFallback('performance.memory');
      expect(memoryFallback).toHaveProperty('usedJSHeapSize');

      const audioContextFallback = getAPIFallback('AudioContext');
      expect(audioContextFallback).toHaveProperty('state');

      const unknownFallback = getAPIFallback('unknown');
      expect(unknownFallback).toBeNull();
    });
  });

  describe('safeAPICall', () => {
    it('should call API when available', () => {
      const apiCall = vi.fn(() => 'success');
      const fallback = 'fallback';

      const result = safeAPICall('matchMedia', apiCall, fallback);

      if (isAPIAvailable('matchMedia')) {
        expect(apiCall).toHaveBeenCalled();
        expect(result).toBe('success');
      } else {
        expect(result).toBe(fallback);
      }
    });

    it('should use fallback when API throws error', () => {
      const apiCall = vi.fn(() => {
        throw new Error('API error');
      });
      const fallback = 'fallback';

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = safeAPICall('matchMedia', apiCall, fallback);

      expect(result).toBe(fallback);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API call failed for matchMedia:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should use fallback when API is not available', () => {
      const apiCall = vi.fn(() => 'success');
      const fallback = 'fallback';

      const result = safeAPICall('unknownAPI', apiCall, fallback);

      expect(apiCall).not.toHaveBeenCalled();
      expect(result).toBe(fallback);
    });
  });
});