/**
 * Browser Compatibility Hook Tests
 * 
 * Tests for the useBrowserCompatibility hook and related functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBrowserCompatibility, useAPIWithFallback, useMediaQuery } from '../useBrowserCompatibility';

// Mock the browser API fallbacks module
vi.mock('../browserAPIFallbacks', () => ({
  initializeBrowserAPIFallbacks: vi.fn(),
  isAPIAvailable: vi.fn(),
  isFallbackApplied: vi.fn(),
  getAPIAvailabilityReport: vi.fn(),
  getBrowserCompatibilityWarnings: vi.fn(),
  clearBrowserCompatibilityWarnings: vi.fn()
}));

// Mock the toast hook
vi.mock('../use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

import {
  initializeBrowserAPIFallbacks,
  isAPIAvailable,
  isFallbackApplied,
  getAPIAvailabilityReport,
  getBrowserCompatibilityWarnings,
  clearBrowserCompatibilityWarnings
} from '@/utils/browserAPIFallbacks';

describe('useBrowserCompatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    (getAPIAvailabilityReport as any).mockReturnValue({
      matchMedia: { available: true, fallbackApplied: false },
      AudioContext: { available: false, fallbackApplied: true },
      IntersectionObserver: { available: true, fallbackApplied: false },
      ResizeObserver: { available: true, fallbackApplied: false },
      'performance.memory': { available: false, fallbackApplied: true },
      requestIdleCallback: { available: true, fallbackApplied: false },
      OffscreenCanvas: { available: false, fallbackApplied: true },
      WebGL: { available: true, fallbackApplied: false }
    });
    
    (getBrowserCompatibilityWarnings as any).mockReturnValue([]);
    (isAPIAvailable as any).mockImplementation((apiName: string) => {
      const report = getAPIAvailabilityReport();
      return report[apiName]?.available ?? false;
    });
    (isFallbackApplied as any).mockImplementation((apiName: string) => {
      const report = getAPIAvailabilityReport();
      return report[apiName]?.fallbackApplied ?? false;
    });
  });

  it('should initialize browser API fallbacks on mount', () => {
    renderHook(() => useBrowserCompatibility());
    
    expect(initializeBrowserAPIFallbacks).toHaveBeenCalledOnce();
  });

  it('should calculate compatibility score correctly', () => {
    const { result } = renderHook(() => useBrowserCompatibility());
    
    // With 6 out of 8 APIs available, score should be 75%
    expect(result.current.compatibilityScore).toBe(75);
  });

  it('should identify missing APIs', () => {
    const { result } = renderHook(() => useBrowserCompatibility());
    
    expect(result.current.missingAPIs).toContain('AudioContext');
    expect(result.current.missingAPIs).toContain('performance.memory');
    expect(result.current.missingAPIs).toContain('OffscreenCanvas');
  });

  it('should identify critical missing APIs', () => {
    // Mock WebGL as missing
    (getAPIAvailabilityReport as any).mockReturnValue({
      matchMedia: { available: true, fallbackApplied: false },
      AudioContext: { available: false, fallbackApplied: true },
      IntersectionObserver: { available: true, fallbackApplied: false },
      ResizeObserver: { available: true, fallbackApplied: false },
      'performance.memory': { available: false, fallbackApplied: true },
      requestIdleCallback: { available: true, fallbackApplied: false },
      OffscreenCanvas: { available: false, fallbackApplied: true },
      WebGL: { available: false, fallbackApplied: false }
    });

    const { result } = renderHook(() => useBrowserCompatibility());
    
    expect(result.current.criticalMissing).toContain('WebGL');
    expect(result.current.criticalMissing).toContain('AudioContext');
  });

  it('should identify applied fallbacks', () => {
    const { result } = renderHook(() => useBrowserCompatibility());
    
    expect(result.current.fallbacksApplied).toContain('AudioContext');
    expect(result.current.fallbacksApplied).toContain('performance.memory');
    expect(result.current.fallbacksApplied).toContain('OffscreenCanvas');
  });

  it('should refresh status when requested', () => {
    const { result } = renderHook(() => useBrowserCompatibility());
    
    // Change the mock to return different values
    (getAPIAvailabilityReport as any).mockReturnValue({
      matchMedia: { available: true, fallbackApplied: false },
      AudioContext: { available: true, fallbackApplied: false }, // Now available
      IntersectionObserver: { available: true, fallbackApplied: false },
      ResizeObserver: { available: true, fallbackApplied: false },
      'performance.memory': { available: true, fallbackApplied: false }, // Now available
      requestIdleCallback: { available: true, fallbackApplied: false },
      OffscreenCanvas: { available: true, fallbackApplied: false }, // Now available
      WebGL: { available: true, fallbackApplied: false }
    });
    
    act(() => {
      result.current.refreshStatus();
    });
    
    expect(result.current.compatibilityScore).toBe(100);
    expect(result.current.missingAPIs).toHaveLength(0);
  });

  it('should show toast notification for compatibility warnings', () => {
    const mockToast = vi.fn();
    vi.mocked(require('../use-toast').useToast).mockReturnValue({ toast: mockToast });
    
    (getBrowserCompatibilityWarnings as any).mockReturnValue([
      'Audio features are not available in this browser'
    ]);

    renderHook(() => useBrowserCompatibility());
    
    expect(mockToast).toHaveBeenCalledWith({
      title: "Browser Compatibility Notice",
      description: "Audio features are not available in this browser",
      variant: "default",
      duration: 8000
    });
  });

  it('should show destructive toast for critical missing features', () => {
    const mockToast = vi.fn();
    vi.mocked(require('../use-toast').useToast).mockReturnValue({ toast: mockToast });
    
    // Mock critical missing APIs
    (getAPIAvailabilityReport as any).mockReturnValue({
      matchMedia: { available: true, fallbackApplied: false },
      AudioContext: { available: false, fallbackApplied: true },
      IntersectionObserver: { available: true, fallbackApplied: false },
      ResizeObserver: { available: true, fallbackApplied: false },
      'performance.memory': { available: false, fallbackApplied: true },
      requestIdleCallback: { available: true, fallbackApplied: false },
      OffscreenCanvas: { available: false, fallbackApplied: true },
      WebGL: { available: false, fallbackApplied: false } // Critical missing
    });
    
    (getBrowserCompatibilityWarnings as any).mockReturnValue([
      'Hardware acceleration is not available. Performance may be reduced.'
    ]);

    renderHook(() => useBrowserCompatibility());
    
    expect(mockToast).toHaveBeenCalledWith({
      title: "Browser Compatibility Notice",
      description: "Hardware acceleration is not available. Performance may be reduced.",
      variant: "destructive",
      duration: 8000
    });
  });
});

describe('useAPIWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use primary implementation when API is available', () => {
    (isAPIAvailable as any).mockReturnValue(true);
    
    const primaryResult = 'primary';
    const fallbackResult = 'fallback';
    
    const { result } = renderHook(() =>
      useAPIWithFallback(
        'matchMedia',
        () => primaryResult,
        () => fallbackResult
      )
    );
    
    expect(result.current).toBe(primaryResult);
  });

  it('should use fallback implementation when API is not available', () => {
    (isAPIAvailable as any).mockReturnValue(false);
    
    const primaryResult = 'primary';
    const fallbackResult = 'fallback';
    
    const { result } = renderHook(() =>
      useAPIWithFallback(
        'matchMedia',
        () => primaryResult,
        () => fallbackResult
      )
    );
    
    expect(result.current).toBe(fallbackResult);
  });

  it('should use fallback when primary implementation throws error', () => {
    (isAPIAvailable as any).mockReturnValue(true);
    
    const fallbackResult = 'fallback';
    
    const { result } = renderHook(() =>
      useAPIWithFallback(
        'matchMedia',
        () => { throw new Error('Primary failed'); },
        () => fallbackResult
      )
    );
    
    expect(result.current).toBe(fallbackResult);
  });

  it('should update when dependencies change', () => {
    (isAPIAvailable as any).mockReturnValue(true);
    
    let counter = 0;
    const { result, rerender } = renderHook(
      ({ dep }) => useAPIWithFallback(
        'matchMedia',
        () => `primary-${counter++}`,
        () => 'fallback',
        [dep]
      ),
      { initialProps: { dep: 1 } }
    );
    
    expect(result.current).toBe('primary-0');
    
    rerender({ dep: 2 });
    expect(result.current).toBe('primary-1');
  });
});

describe('useMediaQuery', () => {
  const mockMatchMedia = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });
  });

  it('should use matchMedia when available', () => {
    (isAPIAvailable as any).mockReturnValue(true);
    
    const mockMediaQueryList = {
      matches: true,
      addListener: vi.fn(),
      removeListener: vi.fn()
    };
    
    mockMatchMedia.mockReturnValue(mockMediaQueryList);
    
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 768px)');
    expect(result.current).toBe(true);
  });

  it('should use fallback when matchMedia is not available', () => {
    (isAPIAvailable as any).mockReturnValue(false);
    
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    
    // Should use fallback logic (assume desktop, so max-width: 768px should be false)
    expect(result.current).toBe(false);
  });

  it('should handle dark mode query fallback', () => {
    (isAPIAvailable as any).mockReturnValue(false);
    
    const { result } = renderHook(() => useMediaQuery('(prefers-color-scheme: dark)'));
    
    // Should default to light theme
    expect(result.current).toBe(false);
  });

  it('should handle reduced motion query fallback', () => {
    (isAPIAvailable as any).mockReturnValue(false);
    
    const { result } = renderHook(() => useMediaQuery('(prefers-reduced-motion: reduce)'));
    
    // Should default to no reduced motion
    expect(result.current).toBe(false);
  });
});