/**
 * Test Environment Detection and Browser API Mocking Utility
 * 
 * This utility provides functions to detect test environments and create
 * fallback implementations for missing browser APIs in tests.
 */

// Type definitions for browser APIs that might be missing in tests
interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null;
  addListener: (listener: (ev: MediaQueryListEvent) => void) => void;
  removeListener: (listener: (ev: MediaQueryListEvent) => void) => void;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatchEvent: (event: Event) => boolean;
}

interface MockPerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface MockAudioContext {
  state: AudioContextState;
  sampleRate: number;
  currentTime: number;
  destination: AudioDestinationNode;
  listener: AudioListener;
  close: () => Promise<void>;
  createBuffer: (numberOfChannels: number, length: number, sampleRate: number) => AudioBuffer;
  createBufferSource: () => AudioBufferSourceNode;
  createGain: () => GainNode;
  resume: () => Promise<void>;
  suspend: () => Promise<void>;
}

/**
 * Detects if the current environment is a test environment
 */
export function isTestEnvironment(): boolean {
  // Check for common test environment indicators
  return (
    // Vitest/Jest environment
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
    // Vitest specific
    (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') ||
    // jsdom environment
    (typeof window !== 'undefined' && window.navigator?.userAgent?.includes('jsdom')) ||
    // Check for test globals
    (typeof global !== 'undefined' && 
     (global.hasOwnProperty('expect') || global.hasOwnProperty('describe') || global.hasOwnProperty('it'))) ||
    // Check for window test globals
    (typeof window !== 'undefined' && 
     (window.hasOwnProperty('expect') || window.hasOwnProperty('describe') || window.hasOwnProperty('it')))
  );
}

/**
 * Checks if a specific browser API is available
 */
export function isAPIAvailable(apiName: string): boolean {
  if (typeof window === 'undefined') return false;
  
  switch (apiName) {
    case 'matchMedia':
      return typeof window.matchMedia === 'function';
    case 'performance.memory':
      return 'memory' in performance;
    case 'AudioContext':
      return typeof window.AudioContext === 'function' || typeof (window as any).webkitAudioContext === 'function';
    case 'IntersectionObserver':
      return typeof window.IntersectionObserver === 'function';
    case 'ResizeObserver':
      return typeof window.ResizeObserver === 'function';
    default:
      return false;
  }
}

/**
 * Creates a mock implementation of window.matchMedia
 */
export function createMockMatchMedia(): (query: string) => MockMediaQueryList {
  return (query: string): MockMediaQueryList => {
    const listeners: ((ev: MediaQueryListEvent) => void)[] = [];
    
    // Parse common media queries to provide realistic defaults
    let matches = false;
    if (query.includes('prefers-color-scheme: dark')) {
      matches = false; // Default to light theme in tests
    } else if (query.includes('prefers-reduced-motion: reduce')) {
      matches = false; // Default to no reduced motion in tests
    } else if (query.includes('prefers-contrast: high')) {
      matches = false; // Default to normal contrast in tests
    } else if (query.includes('max-width') || query.includes('min-width')) {
      // For responsive queries, default to desktop size
      const width = parseInt(query.match(/\d+/)?.[0] || '1024');
      matches = query.includes('max-width') ? 1024 <= width : 1024 >= width;
    }

    const mockMediaQueryList: MockMediaQueryList = {
      matches,
      media: query,
      onchange: null,
      addListener: (listener: (ev: MediaQueryListEvent) => void) => {
        listeners.push(listener);
      },
      removeListener: (listener: (ev: MediaQueryListEvent) => void) => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      },
      addEventListener: (type: string, listener: EventListener) => {
        if (type === 'change') {
          listeners.push(listener as (ev: MediaQueryListEvent) => void);
        }
      },
      removeEventListener: (type: string, listener: EventListener) => {
        if (type === 'change') {
          const index = listeners.indexOf(listener as (ev: MediaQueryListEvent) => void);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      },
      dispatchEvent: (event: Event) => {
        listeners.forEach(listener => {
          try {
            listener(event as MediaQueryListEvent);
          } catch (error) {
            console.error('Error in media query listener:', error);
          }
        });
        return true;
      }
    };

    return mockMediaQueryList;
  };
}

/**
 * Creates a mock implementation of performance.memory
 */
export function createMockPerformanceMemory(): MockPerformanceMemory {
  return {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
  };
}

/**
 * Creates a mock implementation of AudioContext
 */
export function createMockAudioContext(): Partial<MockAudioContext> {
  return {
    state: 'running' as AudioContextState,
    sampleRate: 44100,
    currentTime: 0,
    close: async () => {},
    resume: async () => {},
    suspend: async () => {},
    createBuffer: (numberOfChannels: number, length: number, sampleRate: number) => {
      // Return a minimal mock AudioBuffer
      return {
        numberOfChannels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: () => new Float32Array(length),
        copyFromChannel: () => {},
        copyToChannel: () => {}
      } as AudioBuffer;
    },
    createBufferSource: () => {
      // Return a minimal mock AudioBufferSourceNode
      return {
        buffer: null,
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {}
      } as any;
    },
    createGain: () => {
      // Return a minimal mock GainNode
      return {
        gain: { value: 1 },
        connect: () => {},
        disconnect: () => {}
      } as any;
    }
  };
}

/**
 * Sets up browser API mocks for test environment
 */
export function setupBrowserAPIMocks(): void {
  if (!isTestEnvironment()) {
    return; // Only setup mocks in test environment
  }

  // Mock window.matchMedia if not available
  if (!isAPIAvailable('matchMedia')) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMockMatchMedia()
    });
  }

  // Mock performance.memory if not available
  if (!isAPIAvailable('performance.memory')) {
    Object.defineProperty(performance, 'memory', {
      writable: true,
      value: createMockPerformanceMemory()
    });
  }

  // Mock AudioContext if not available
  if (!isAPIAvailable('AudioContext')) {
    const MockAudioContextClass = function() {
      return createMockAudioContext();
    };
    
    Object.defineProperty(window, 'AudioContext', {
      writable: true,
      value: MockAudioContextClass
    });
    
    // Also mock webkitAudioContext for older browsers
    Object.defineProperty(window, 'webkitAudioContext', {
      writable: true,
      value: MockAudioContextClass
    });
  }

  // Mock IntersectionObserver if not available
  if (!isAPIAvailable('IntersectionObserver')) {
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      value: class MockIntersectionObserver {
        constructor(_callback: IntersectionObserverCallback) {}
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    });
  }

  // Mock ResizeObserver if not available
  if (!isAPIAvailable('ResizeObserver')) {
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: class MockResizeObserver {
        constructor(_callback: ResizeObserverCallback) {}
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    });
  }
}

/**
 * Provides a fallback implementation for a specific API
 */
export function getAPIFallback(apiName: string): any {
  switch (apiName) {
    case 'matchMedia':
      return createMockMatchMedia();
    case 'performance.memory':
      return createMockPerformanceMemory();
    case 'AudioContext':
      return createMockAudioContext();
    default:
      return null;
  }
}

/**
 * Safely calls a browser API with fallback
 */
export function safeAPICall<T>(
  apiName: string,
  apiCall: () => T,
  fallback: T
): T {
  try {
    if (isAPIAvailable(apiName)) {
      return apiCall();
    } else {
      return fallback;
    }
  } catch (error) {
    console.warn(`API call failed for ${apiName}:`, error);
    return fallback;
  }
}