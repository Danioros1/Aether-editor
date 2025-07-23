/**
 * Browser API Fallbacks Tests
 * 
 * Tests for the browser API fallback system functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeBrowserAPIFallbacks,
  isAPIAvailable,
  isFallbackApplied,
  getAPIAvailabilityReport,
  getBrowserCompatibilityWarnings,
  clearBrowserCompatibilityWarnings,
  withAPIFallback,
  API_CHECKS
} from '../browserAPIFallbacks';

// Mock window and global objects
const mockWindow = {} as any;
const mockPerformance = {} as any;

describe('Browser API Fallbacks', () => {
  beforeEach(() => {
    // Reset global state
    vi.clearAllMocks();
    
    // Mock window object
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true
    });
    
    // Mock performance object
    Object.defineProperty(global, 'performance', {
      value: mockPerformance,
      writable: true
    });
    
    // Clear any existing fallback warnings
    clearBrowserCompatibilityWarnings();
  });

  afterEach(() => {
    // Clean up any applied fallbacks
    delete (window as any).__browserCompatibilityWarnings;
  });

  describe('API availability checks', () => {
    it('should detect missing matchMedia API', () => {
      // Don't define matchMedia
      const matchMediaCheck = API_CHECKS.find(check => check.name === 'matchMedia');
      expect(matchMediaCheck?.check()).toBe(false);
    });

    it('should detect available matchMedia API', () => {
      mockWindow.matchMedia = vi.fn();
      const matchMediaCheck = API_CHECKS.find(check => check.name === 'matchMedia');
      expect(matchMediaCheck?.check()).toBe(true);
    });

    it('should detect missing AudioContext API', () => {
      const audioContextCheck = API_CHECKS.find(check => check.name === 'AudioContext');
      expect(audioContextCheck?.check()).toBe(false);
    });

    it('should detect available AudioContext API', () => {
      mockWindow.AudioContext = vi.fn();
      const audioContextCheck = API_CHECKS.find(check => check.name === 'AudioContext');
      expect(audioContextCheck?.check()).toBe(true);
    });

    it('should detect webkit AudioContext API', () => {
      mockWindow.webkitAudioContext = vi.fn();
      const audioContextCheck = API_CHECKS.find(check => check.name === 'AudioContext');
      expect(audioContextCheck?.check()).toBe(true);
    });

    it('should detect missing performance.memory', () => {
      const memoryCheck = API_CHECKS.find(check => check.name === 'performance.memory');
      expect(memoryCheck?.check()).toBe(false);
    });

    it('should detect available performance.memory', () => {
      mockPerformance.memory = {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000000
      };
      const memoryCheck = API_CHECKS.find(check => check.name === 'performance.memory');
      expect(memoryCheck?.check()).toBe(true);
    });

    it('should detect missing IntersectionObserver', () => {
      const observerCheck = API_CHECKS.find(check => check.name === 'IntersectionObserver');
      expect(observerCheck?.check()).toBe(false);
    });

    it('should detect available IntersectionObserver', () => {
      mockWindow.IntersectionObserver = vi.fn();
      const observerCheck = API_CHECKS.find(check => check.name === 'IntersectionObserver');
      expect(observerCheck?.check()).toBe(true);
    });
  });

  describe('Fallback initialization', () => {
    it('should initialize fallbacks for missing APIs', () => {
      // Ensure APIs are missing
      delete mockWindow.matchMedia;
      delete mockWindow.AudioContext;
      delete mockWindow.webkitAudioContext;
      delete mockPerformance.memory;

      initializeBrowserAPIFallbacks();

      // Check that fallbacks were applied
      expect(isFallbackApplied('matchMedia')).toBe(true);
      expect(isFallbackApplied('AudioContext')).toBe(true);
      expect(isFallbackApplied('performance.memory')).toBe(true);
    });

    it('should not apply fallbacks for available APIs', () => {
      // Make APIs available
      mockWindow.matchMedia = vi.fn();
      mockWindow.AudioContext = vi.fn();
      mockPerformance.memory = { usedJSHeapSize: 1000000 };

      initializeBrowserAPIFallbacks();

      // Check that fallbacks were not applied
      expect(isFallbackApplied('matchMedia')).toBe(false);
      expect(isFallbackApplied('AudioContext')).toBe(false);
      expect(isFallbackApplied('performance.memory')).toBe(false);
    });

    it('should set browser compatibility warnings for critical missing APIs', () => {
      // Remove critical APIs
      delete mockWindow.AudioContext;
      delete mockWindow.webkitAudioContext;

      initializeBrowserAPIFallbacks();

      const warnings = getBrowserCompatibilityWarnings();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(warning => warning.includes('Audio features'))).toBe(true);
    });
  });

  describe('matchMedia fallback', () => {
    beforeEach(() => {
      delete mockWindow.matchMedia;
      initializeBrowserAPIFallbacks();
    });

    it('should provide working matchMedia fallback', () => {
      expect(typeof window.matchMedia).toBe('function');
      
      const mediaQuery = window.matchMedia('(max-width: 768px)');
      expect(mediaQuery).toHaveProperty('matches');
      expect(mediaQuery).toHaveProperty('media');
      expect(mediaQuery).toHaveProperty('addListener');
      expect(mediaQuery).toHaveProperty('removeListener');
    });

    it('should handle media query parsing in fallback', () => {
      const desktopQuery = window.matchMedia('(max-width: 768px)');
      expect(desktopQuery.matches).toBe(false); // Should default to desktop size

      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      expect(darkModeQuery.matches).toBe(false); // Should default to light theme
    });
  });

  describe('AudioContext fallback', () => {
    beforeEach(() => {
      delete mockWindow.AudioContext;
      delete mockWindow.webkitAudioContext;
      initializeBrowserAPIFallbacks();
    });

    it('should provide working AudioContext fallback', () => {
      expect(typeof window.AudioContext).toBe('function');
      
      const audioContext = new window.AudioContext();
      expect(audioContext).toHaveProperty('state');
      expect(audioContext).toHaveProperty('sampleRate');
      expect(audioContext).toHaveProperty('createBuffer');
      expect(audioContext).toHaveProperty('createBufferSource');
      expect(audioContext).toHaveProperty('createGain');
    });

    it('should provide mock audio buffer from fallback', () => {
      const audioContext = new window.AudioContext();
      const buffer = audioContext.createBuffer(2, 1024, 44100);
      
      expect(buffer.numberOfChannels).toBe(2);
      expect(buffer.length).toBe(1024);
      expect(buffer.sampleRate).toBe(44100);
    });
  });

  describe('IntersectionObserver fallback', () => {
    beforeEach(() => {
      delete mockWindow.IntersectionObserver;
      initializeBrowserAPIFallbacks();
    });

    it('should provide working IntersectionObserver fallback', () => {
      expect(typeof window.IntersectionObserver).toBe('function');
      
      const callback = vi.fn();
      const observer = new window.IntersectionObserver(callback);
      
      expect(observer).toHaveProperty('observe');
      expect(observer).toHaveProperty('unobserve');
      expect(observer).toHaveProperty('disconnect');
    });

    it('should trigger callback when observing element', (done) => {
      const callback = vi.fn((entries) => {
        expect(entries).toHaveLength(1);
        expect(entries[0]).toHaveProperty('isIntersecting', true);
        done();
      });
      
      const observer = new window.IntersectionObserver(callback);
      const mockElement = {
        getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 })
      } as Element;
      
      observer.observe(mockElement);
    });
  });

  describe('Performance memory fallback', () => {
    beforeEach(() => {
      delete mockPerformance.memory;
      initializeBrowserAPIFallbacks();
    });

    it('should provide performance.memory fallback', () => {
      expect(performance.memory).toBeDefined();
      expect(performance.memory).toHaveProperty('usedJSHeapSize');
      expect(performance.memory).toHaveProperty('totalJSHeapSize');
      expect(performance.memory).toHaveProperty('jsHeapSizeLimit');
    });

    it('should provide reasonable fallback values', () => {
      expect(performance.memory.usedJSHeapSize).toBeGreaterThan(0);
      expect(performance.memory.totalJSHeapSize).toBeGreaterThan(performance.memory.usedJSHeapSize);
      expect(performance.memory.jsHeapSizeLimit).toBeGreaterThan(performance.memory.totalJSHeapSize);
    });
  });

  describe('API availability reporting', () => {
    it('should provide accurate availability report', () => {
      // Set up mixed availability
      mockWindow.matchMedia = vi.fn();
      delete mockWindow.AudioContext;
      delete mockWindow.webkitAudioContext;
      
      initializeBrowserAPIFallbacks();
      
      const report = getAPIAvailabilityReport();
      
      expect(report.matchMedia.available).toBe(true);
      expect(report.matchMedia.fallbackApplied).toBe(false);
      
      expect(report.AudioContext.available).toBe(false);
      expect(report.AudioContext.fallbackApplied).toBe(true);
    });
  });

  describe('withAPIFallback utility', () => {
    it('should use primary implementation when API is available', () => {
      mockWindow.matchMedia = vi.fn();
      initializeBrowserAPIFallbacks();
      
      const primaryResult = 'primary';
      const fallbackResult = 'fallback';
      
      const result = withAPIFallback(
        'matchMedia',
        () => primaryResult,
        () => fallbackResult
      );
      
      expect(result).toBe(primaryResult);
    });

    it('should use fallback implementation when API is not available', () => {
      delete mockWindow.matchMedia;
      initializeBrowserAPIFallbacks();
      
      const primaryResult = 'primary';
      const fallbackResult = 'fallback';
      
      const result = withAPIFallback(
        'matchMedia',
        () => primaryResult,
        () => fallbackResult
      );
      
      expect(result).toBe(fallbackResult);
    });

    it('should use fallback when primary implementation throws error', () => {
      mockWindow.matchMedia = vi.fn();
      initializeBrowserAPIFallbacks();
      
      const fallbackResult = 'fallback';
      
      const result = withAPIFallback(
        'matchMedia',
        () => { throw new Error('Primary failed'); },
        () => fallbackResult
      );
      
      expect(result).toBe(fallbackResult);
    });
  });

  describe('Browser compatibility warnings', () => {
    it('should store and retrieve compatibility warnings', () => {
      const testWarnings = ['Test warning 1', 'Test warning 2'];
      (window as any).__browserCompatibilityWarnings = testWarnings;
      
      const warnings = getBrowserCompatibilityWarnings();
      expect(warnings).toEqual(testWarnings);
    });

    it('should clear compatibility warnings', () => {
      (window as any).__browserCompatibilityWarnings = ['Test warning'];
      
      clearBrowserCompatibilityWarnings();
      
      const warnings = getBrowserCompatibilityWarnings();
      expect(warnings).toEqual([]);
    });

    it('should return empty array when no warnings exist', () => {
      const warnings = getBrowserCompatibilityWarnings();
      expect(warnings).toEqual([]);
    });
  });
});