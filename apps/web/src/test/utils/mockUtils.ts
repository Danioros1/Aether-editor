import { vi } from 'vitest';
import { testCleanup } from './testCleanup';

/**
 * Enhanced mock store with automatic cleanup
 */
export const createMockStore = <T extends Record<string, any>>(initialState: T) => {
  const store = { ...initialState };
  
  // Convert all functions to mocks
  Object.keys(store).forEach(key => {
    if (typeof store[key] === 'function') {
      store[key] = vi.fn(store[key]);
    }
  });
  
  // Add cleanup
  testCleanup.addCleanupTask('Mock store cleanup', () => {
    Object.keys(store).forEach(key => {
      if (vi.isMockFunction(store[key])) {
        store[key].mockClear();
      }
    });
  });
  
  return store;
};

/**
 * Mock API responses with automatic cleanup
 */
export const mockApiResponse = <T>(
  url: string | RegExp,
  response: T,
  options: {
    status?: number;
    delay?: number;
    shouldFail?: boolean;
    failureMessage?: string;
  } = {}
) => {
  const { status = 200, delay = 0, shouldFail = false, failureMessage = 'API Error' } = options;
  
  const originalFetch = global.fetch;
  
  global.fetch = vi.fn().mockImplementation((requestUrl: string) => {
    const matches = typeof url === 'string' 
      ? requestUrl.includes(url)
      : url.test(requestUrl);
    
    if (matches) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (shouldFail) {
            reject(new Error(failureMessage));
          } else {
            resolve({
              ok: status >= 200 && status < 300,
              status,
              json: () => Promise.resolve(response),
              text: () => Promise.resolve(JSON.stringify(response))
            } as Response);
          }
        }, delay);
      });
    }
    
    return originalFetch(requestUrl);
  });
  
  testCleanup.addCleanupTask('API mock cleanup', () => {
    global.fetch = originalFetch;
  });
};

/**
 * Mock browser APIs with automatic cleanup
 */
export const mockBrowserAPI = {
  /**
   * Mock localStorage
   */
  localStorage: (initialData: Record<string, string> = {}) => {
    const storage = new Map(Object.entries(initialData));
    const originalLocalStorage = global.localStorage;
    
    global.localStorage = {
      getItem: vi.fn((key: string) => storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      length: 0,
      key: vi.fn(() => null)
    };
    
    testCleanup.addCleanupTask('localStorage mock cleanup', () => {
      global.localStorage = originalLocalStorage;
    });
    
    return global.localStorage;
  },

  /**
   * Mock matchMedia
   */
  matchMedia: (queries: Record<string, boolean>) => {
    const originalMatchMedia = global.matchMedia;
    
    global.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: queries[query] || false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    testCleanup.addCleanupTask('matchMedia mock cleanup', () => {
      global.matchMedia = originalMatchMedia;
    });
  },

  /**
   * Mock ResizeObserver
   */
  resizeObserver: () => {
    const mockResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
    
    global.ResizeObserver = mockResizeObserver;
    
    testCleanup.addCleanupTask('ResizeObserver mock cleanup', () => {
      delete (global as any).ResizeObserver;
    });
    
    return mockResizeObserver;
  },

  /**
   * Mock IntersectionObserver
   */
  intersectionObserver: () => {
    const mockIntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
    
    global.IntersectionObserver = mockIntersectionObserver;
    
    testCleanup.addCleanupTask('IntersectionObserver mock cleanup', () => {
      delete (global as any).IntersectionObserver;
    });
    
    return mockIntersectionObserver;
  },

  /**
   * Mock performance API
   */
  performance: (memoryData?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }) => {
    const originalPerformance = global.performance;
    
    global.performance = {
      ...originalPerformance,
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      memory: memoryData || {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
      }
    };
    
    testCleanup.addCleanupTask('performance mock cleanup', () => {
      global.performance = originalPerformance;
    });
  }
};

/**
 * Mock media APIs
 */
export const mockMediaAPI = {
  /**
   * Mock HTMLVideoElement
   */
  videoElement: () => {
    const mockVideo = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      currentTime: 0,
      duration: 10,
      paused: true,
      ended: false,
      readyState: 4,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    };
    
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'video') {
        return mockVideo as any;
      }
      return originalCreateElement.call(document, tagName);
    });
    
    testCleanup.addCleanupTask('video element mock cleanup', () => {
      document.createElement = originalCreateElement;
    });
    
    return mockVideo;
  },

  /**
   * Mock HTMLCanvasElement
   */
  canvasElement: () => {
    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    };
    
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(mockContext),
      width: 800,
      height: 600,
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mock'),
      toBlob: vi.fn().mockImplementation((callback) => {
        callback(new Blob(['mock'], { type: 'image/png' }));
      })
    };
    
    const originalCreateElement = document.createElement;
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as any;
      }
      return originalCreateElement.call(document, tagName);
    });
    
    testCleanup.addCleanupTask('canvas element mock cleanup', () => {
      document.createElement = originalCreateElement;
    });
    
    return { canvas: mockCanvas, context: mockContext };
  },

  /**
   * Mock File API
   */
  fileAPI: () => {
    const originalFile = global.File;
    const originalFileReader = global.FileReader;
    
    global.File = vi.fn().mockImplementation((bits: any[], name: string, options: any) => ({
      name,
      size: bits.join('').length,
      type: options?.type || 'application/octet-stream',
      lastModified: Date.now(),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      text: vi.fn().mockResolvedValue(bits.join('')),
      stream: vi.fn()
    })) as any;
    
    global.FileReader = vi.fn().mockImplementation(() => ({
      readAsDataURL: vi.fn().mockImplementation(function(this: any) {
        setTimeout(() => {
          this.onload?.({ target: { result: 'data:image/png;base64,mock' } });
        }, 0);
      }),
      readAsText: vi.fn().mockImplementation(function(this: any) {
        setTimeout(() => {
          this.onload?.({ target: { result: 'mock text' } });
        }, 0);
      }),
      readAsArrayBuffer: vi.fn().mockImplementation(function(this: any) {
        setTimeout(() => {
          this.onload?.({ target: { result: new ArrayBuffer(8) } });
        }, 0);
      }),
      onload: null,
      onerror: null,
      onprogress: null
    })) as any;
    
    testCleanup.addCleanupTask('File API mock cleanup', () => {
      global.File = originalFile;
      global.FileReader = originalFileReader;
    });
  }
};

/**
 * Create a mock with automatic call tracking
 */
export const createTrackedMock = <T extends (...args: any[]) => any>(
  name: string,
  implementation?: T
) => {
  const calls: Array<{ args: Parameters<T>; result: ReturnType<T>; timestamp: number }> = [];
  
  const mock = vi.fn().mockImplementation((...args: Parameters<T>) => {
    const result = implementation ? implementation(...args) : undefined;
    calls.push({ args, result, timestamp: Date.now() });
    return result;
  });
  
  // Add tracking methods
  (mock as any).getCalls = () => calls;
  (mock as any).getLastCall = () => calls[calls.length - 1];
  (mock as any).getCallCount = () => calls.length;
  (mock as any).wasCalledWith = (...args: Parameters<T>) => 
    calls.some(call => JSON.stringify(call.args) === JSON.stringify(args));
  
  testCleanup.addCleanupTask(`Tracked mock cleanup: ${name}`, () => {
    mock.mockClear();
    calls.length = 0;
  });
  
  return mock;
};