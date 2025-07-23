/**
 * Browser API Fallback System
 * 
 * Provides graceful degradation for missing browser APIs in production environments.
 * This system detects missing APIs and provides fallback implementations to ensure
 * the application continues functioning even when certain browser features are unavailable.
 */

import { useToast } from '@/hooks/use-toast';

// Types for API availability checks
export interface APIAvailabilityCheck {
  name: string;
  check: () => boolean;
  fallback: () => any;
  criticalLevel: 'low' | 'medium' | 'high' | 'critical';
  userMessage?: string;
}

// Global state for tracking API availability
const apiAvailability = new Map<string, boolean>();
const fallbacksApplied = new Set<string>();

/**
 * Comprehensive browser API availability checks
 */
export const API_CHECKS: APIAvailabilityCheck[] = [
  {
    name: 'matchMedia',
    check: () => typeof window !== 'undefined' && typeof window.matchMedia === 'function',
    fallback: createMatchMediaFallback,
    criticalLevel: 'medium',
    userMessage: 'Some responsive features may not work optimally'
  },
  {
    name: 'AudioContext',
    check: () => typeof window !== 'undefined' && 
      (typeof window.AudioContext === 'function' || typeof (window as any).webkitAudioContext === 'function'),
    fallback: createAudioContextFallback,
    criticalLevel: 'high',
    userMessage: 'Audio features are not available in this browser'
  },
  {
    name: 'IntersectionObserver',
    check: () => typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function',
    fallback: createIntersectionObserverFallback,
    criticalLevel: 'medium',
    userMessage: 'Some performance optimizations are not available'
  },
  {
    name: 'ResizeObserver',
    check: () => typeof window !== 'undefined' && typeof window.ResizeObserver === 'function',
    fallback: createResizeObserverFallback,
    criticalLevel: 'medium',
    userMessage: 'Some layout features may not work optimally'
  },
  {
    name: 'performance.memory',
    check: () => typeof performance !== 'undefined' && 'memory' in performance,
    fallback: createPerformanceMemoryFallback,
    criticalLevel: 'low',
    userMessage: 'Memory monitoring is not available'
  },
  {
    name: 'requestIdleCallback',
    check: () => typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function',
    fallback: createRequestIdleCallbackFallback,
    criticalLevel: 'low'
  },
  {
    name: 'OffscreenCanvas',
    check: () => typeof window !== 'undefined' && typeof window.OffscreenCanvas === 'function',
    fallback: createOffscreenCanvasFallback,
    criticalLevel: 'medium',
    userMessage: 'Some rendering optimizations are not available'
  },
  {
    name: 'WebGL',
    check: () => {
      if (typeof window === 'undefined') return false;
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch {
        return false;
      }
    },
    fallback: createWebGLFallback,
    criticalLevel: 'critical',
    userMessage: 'Hardware acceleration is not available. Performance may be reduced.'
  }
];

/**
 * Initialize the browser API fallback system
 */
export function initializeBrowserAPIFallbacks(): void {
  console.log('🔧 Initializing browser API fallback system...');
  
  const missingAPIs: APIAvailabilityCheck[] = [];
  
  // Check all APIs and track availability
  API_CHECKS.forEach(apiCheck => {
    const isAvailable = apiCheck.check();
    apiAvailability.set(apiCheck.name, isAvailable);
    
    if (!isAvailable) {
      missingAPIs.push(apiCheck);
      console.warn(`⚠️ Missing API: ${apiCheck.name} (${apiCheck.criticalLevel} priority)`);
    }
  });
  
  // Apply fallbacks for missing APIs
  missingAPIs.forEach(apiCheck => {
    try {
      apiCheck.fallback();
      fallbacksApplied.add(apiCheck.name);
      console.log(`✅ Applied fallback for: ${apiCheck.name}`);
    } catch (error) {
      console.error(`❌ Failed to apply fallback for ${apiCheck.name}:`, error);
    }
  });
  
  // Notify user about critical missing features
  const criticalMissing = missingAPIs.filter(api => 
    (api.criticalLevel === 'critical' || api.criticalLevel === 'high') && api.userMessage
  );
  
  if (criticalMissing.length > 0) {
    notifyUserAboutMissingFeatures(criticalMissing);
  }
  
  console.log(`🎯 Browser API fallback system initialized. ${fallbacksApplied.size} fallbacks applied.`);
}

/**
 * Check if a specific API is available
 */
export function isAPIAvailable(apiName: string): boolean {
  return apiAvailability.get(apiName) ?? false;
}

/**
 * Check if a fallback has been applied for an API
 */
export function isFallbackApplied(apiName: string): boolean {
  return fallbacksApplied.has(apiName);
}

/**
 * Get a report of all API availability
 */
export function getAPIAvailabilityReport(): Record<string, { available: boolean; fallbackApplied: boolean }> {
  const report: Record<string, { available: boolean; fallbackApplied: boolean }> = {};
  
  API_CHECKS.forEach(apiCheck => {
    report[apiCheck.name] = {
      available: apiAvailability.get(apiCheck.name) ?? false,
      fallbackApplied: fallbacksApplied.has(apiCheck.name)
    };
  });
  
  return report;
}

// Fallback implementations

function createMatchMediaFallback(): void {
  if (typeof window === 'undefined') return;
  
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true
    })
  });
}

function createAudioContextFallback(): void {
  if (typeof window === 'undefined') return;
  
  class MockAudioContext {
    state = 'suspended' as AudioContextState;
    sampleRate = 44100;
    currentTime = 0;
    
    async close() {}
    async resume() {}
    async suspend() {}
    
    createBuffer() {
      return {
        numberOfChannels: 2,
        length: 0,
        sampleRate: 44100,
        duration: 0,
        getChannelData: () => new Float32Array(0),
        copyFromChannel: () => {},
        copyToChannel: () => {}
      } as AudioBuffer;
    }
    
    createBufferSource() {
      return {
        buffer: null,
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {}
      } as any;
    }
    
    createGain() {
      return {
        gain: { value: 1 },
        connect: () => {},
        disconnect: () => {}
      } as any;
    }
  }
  
  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    value: MockAudioContext
  });
}

function createIntersectionObserverFallback(): void {
  if (typeof window === 'undefined') return;
  
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: class MockIntersectionObserver {
      constructor(private callback: IntersectionObserverCallback) {}
      
      observe(target: Element) {
        // Immediately trigger callback with visible state
        setTimeout(() => {
          this.callback([{
            target,
            isIntersecting: true,
            intersectionRatio: 1,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now()
          }], this as any);
        }, 0);
      }
      
      unobserve() {}
      disconnect() {}
    }
  });
}

function createResizeObserverFallback(): void {
  if (typeof window === 'undefined') return;
  
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class MockResizeObserver {
      constructor(private callback: ResizeObserverCallback) {}
      
      observe(target: Element) {
        // Use window resize events as fallback
        const handleResize = () => {
          const rect = target.getBoundingClientRect();
          this.callback([{
            target,
            contentRect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left
            },
            borderBoxSize: [{ blockSize: rect.height, inlineSize: rect.width }],
            contentBoxSize: [{ blockSize: rect.height, inlineSize: rect.width }],
            devicePixelContentBoxSize: [{ blockSize: rect.height, inlineSize: rect.width }]
          }], this as any);
        };
        
        window.addEventListener('resize', handleResize);
        // Store reference for cleanup
        (target as any).__resizeHandler = handleResize;
      }
      
      unobserve(target: Element) {
        const handler = (target as any).__resizeHandler;
        if (handler) {
          window.removeEventListener('resize', handler);
          delete (target as any).__resizeHandler;
        }
      }
      
      disconnect() {}
    }
  });
}

function createPerformanceMemoryFallback(): void {
  if (typeof performance === 'undefined') return;
  
  Object.defineProperty(performance, 'memory', {
    writable: true,
    value: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
    }
  });
}

function createRequestIdleCallbackFallback(): void {
  if (typeof window === 'undefined') return;
  
  Object.defineProperty(window, 'requestIdleCallback', {
    writable: true,
    value: (callback: IdleRequestCallback, options?: IdleRequestOptions) => {
      const timeout = options?.timeout ?? 0;
      return setTimeout(() => {
        const start = Date.now();
        callback({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
        });
      }, timeout);
    }
  });
  
  Object.defineProperty(window, 'cancelIdleCallback', {
    writable: true,
    value: (id: number) => clearTimeout(id)
  });
}

function createOffscreenCanvasFallback(): void {
  if (typeof window === 'undefined') return;
  
  // Create a basic fallback that uses regular canvas
  Object.defineProperty(window, 'OffscreenCanvas', {
    writable: true,
    value: class MockOffscreenCanvas {
      width: number;
      height: number;
      private canvas: HTMLCanvasElement;
      
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
      }
      
      getContext(contextId: string, options?: any) {
        return this.canvas.getContext(contextId, options);
      }
      
      transferToImageBitmap() {
        // Return a mock ImageBitmap-like object
        return {
          width: this.width,
          height: this.height,
          close: () => {}
        };
      }
    }
  });
}

function createWebGLFallback(): void {
  // WebGL fallback is more complex and typically handled at the application level
  // We'll just log that WebGL is not available
  console.warn('WebGL is not available. Canvas 2D rendering will be used as fallback.');
}

/**
 * Notify user about missing critical features
 */
function notifyUserAboutMissingFeatures(missingAPIs: APIAvailabilityCheck[]): void {
  // This would typically integrate with your notification system
  // For now, we'll use console warnings and could integrate with toast notifications
  
  const messages = missingAPIs
    .filter(api => api.userMessage)
    .map(api => api.userMessage!);
  
  if (messages.length > 0) {
    console.warn('⚠️ Browser compatibility notice:', messages.join('. '));
    
    // If toast system is available, show notification
    try {
      // This would need to be called from a React component context
      // For now, we'll store the messages for later display
      (window as any).__browserCompatibilityWarnings = messages;
    } catch (error) {
      // Toast system not available, warnings already logged
    }
  }
}

/**
 * Hook to get browser compatibility warnings for display in React components
 */
export function getBrowserCompatibilityWarnings(): string[] {
  return (window as any).__browserCompatibilityWarnings || [];
}

/**
 * Clear browser compatibility warnings after they've been displayed
 */
export function clearBrowserCompatibilityWarnings(): void {
  delete (window as any).__browserCompatibilityWarnings;
}

/**
 * Safely execute code that depends on a browser API
 */
export function withAPIFallback<T>(
  apiName: string,
  primaryImplementation: () => T,
  fallbackImplementation: () => T
): T {
  try {
    if (isAPIAvailable(apiName)) {
      return primaryImplementation();
    } else {
      return fallbackImplementation();
    }
  } catch (error) {
    console.warn(`API call failed for ${apiName}, using fallback:`, error);
    return fallbackImplementation();
  }
}