// Component rendering optimization utilities
import { useEffect, useRef, useState, useCallback } from 'react';
import { usePerformanceMode } from '../hooks/usePerformanceOptimizer';

// Intersection Observer for lazy loading
class LazyLoadManager {
  private observer: IntersectionObserver | null = null;
  private callbacks = new Map<Element, () => void>();

  constructor() {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const callback = this.callbacks.get(entry.target);
              if (callback) {
                callback();
                this.unobserve(entry.target);
              }
            }
          });
        },
        {
          rootMargin: '50px', // Load 50px before element comes into view
          threshold: 0.1,
        }
      );
    }
  }

  observe(element: Element, callback: () => void): void {
    if (!this.observer) return;
    
    this.callbacks.set(element, callback);
    this.observer.observe(element);
  }

  unobserve(element: Element): void {
    if (!this.observer) return;
    
    this.observer.unobserve(element);
    this.callbacks.delete(element);
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.callbacks.clear();
    }
  }
}

// Singleton lazy load manager
export const lazyLoadManager = new LazyLoadManager();

// Hook for lazy loading components
export const useLazyLoad = (shouldLoad: boolean = true) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shouldLoad || !elementRef.current) return;

    const element = elementRef.current;
    
    lazyLoadManager.observe(element, () => {
      setIsVisible(true);
      // Add a small delay to prevent all components from loading at once
      setTimeout(() => setIsLoaded(true), Math.random() * 100);
    });

    return () => {
      lazyLoadManager.unobserve(element);
    };
  }, [shouldLoad]);

  return {
    elementRef,
    isVisible,
    isLoaded,
    shouldRender: isVisible || isLoaded,
  };
};

// Hook for performance-aware rendering
export const usePerformanceAwareRendering = () => {
  const performanceMode = usePerformanceMode();
  
  return {
    shouldReduceQuality: performanceMode !== 'normal',
    shouldSkipAnimations: performanceMode === 'minimal',
    shouldLimitUpdates: performanceMode === 'minimal',
    shouldUseSimplifiedUI: performanceMode === 'minimal',
    renderingLevel: performanceMode === 'minimal' ? 'basic' : 
                   performanceMode === 'optimized' ? 'reduced' : 'full',
  };
};

// Hook for throttled updates
export const useThrottledUpdates = (delay: number = 100) => {
  const [isThrottled, setIsThrottled] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const throttle = useCallback(() => {
    if (isThrottled) return false;
    
    setIsThrottled(true);
    timeoutRef.current = setTimeout(() => {
      setIsThrottled(false);
    }, delay);
    
    return true;
  }, [isThrottled, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isThrottled, throttle };
};

// Hook for debounced updates
export const useDebouncedUpdates = (delay: number = 300) => {
  const [debouncedValue, setDebouncedValue] = useState<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const updateValue = useCallback((value: any) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { debouncedValue, updateValue };
};

// Hook for render optimization based on visibility
export const useVisibilityOptimization = () => {
  const [isVisible, setIsVisible] = useState(true);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!elementRef.current || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, []);

  return {
    elementRef,
    isVisible,
    shouldRender: isVisible,
  };
};

// Hook for frame-rate aware updates
export const useFrameRateAwareUpdates = () => {
  const [frameRate, setFrameRate] = useState(60);
  const frameTimeRef = useRef<number[]>([]);

  useEffect(() => {
    let animationId: number;
    
    const measureFrameRate = () => {
      const now = performance.now();
      frameTimeRef.current.push(now);
      
      // Keep only last 60 frames
      if (frameTimeRef.current.length > 60) {
        frameTimeRef.current = frameTimeRef.current.slice(-60);
      }
      
      // Calculate frame rate
      if (frameTimeRef.current.length >= 2) {
        const timeSpan = now - frameTimeRef.current[0];
        const fps = (frameTimeRef.current.length - 1) / (timeSpan / 1000);
        setFrameRate(Math.round(fps));
      }
      
      animationId = requestAnimationFrame(measureFrameRate);
    };

    animationId = requestAnimationFrame(measureFrameRate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  const getUpdateInterval = useCallback(() => {
    if (frameRate < 20) return 200; // Update every 200ms for very low frame rates
    if (frameRate < 30) return 100; // Update every 100ms for low frame rates
    if (frameRate < 45) return 50;  // Update every 50ms for medium frame rates
    return 16; // Update every 16ms (60fps) for good frame rates
  }, [frameRate]);

  return {
    frameRate,
    updateInterval: getUpdateInterval(),
    shouldReduceUpdates: frameRate < 30,
  };
};

// Component wrapper for performance optimization
export interface OptimizedComponentProps {
  children: React.ReactNode;
  lazyLoad?: boolean;
  priority?: 'high' | 'medium' | 'low';
  fallback?: React.ReactNode;
  className?: string;
}

// Performance optimization levels
export const OPTIMIZATION_LEVELS = {
  full: {
    animations: true,
    shadows: true,
    gradients: true,
    transitions: true,
    highQualityImages: true,
    complexLayouts: true,
  },
  reduced: {
    animations: true,
    shadows: false,
    gradients: true,
    transitions: true,
    highQualityImages: false,
    complexLayouts: true,
  },
  basic: {
    animations: false,
    shadows: false,
    gradients: false,
    transitions: false,
    highQualityImages: false,
    complexLayouts: false,
  },
} as const;

// Get optimization settings based on performance mode
export const getOptimizationSettings = (mode: 'normal' | 'optimized' | 'minimal') => {
  switch (mode) {
    case 'minimal':
      return OPTIMIZATION_LEVELS.basic;
    case 'optimized':
      return OPTIMIZATION_LEVELS.reduced;
    case 'normal':
    default:
      return OPTIMIZATION_LEVELS.full;
  }
};

// Utility for conditional class names based on performance mode
export const getPerformanceAwareClassName = (
  baseClass: string,
  optimizedClass: string,
  minimalClass: string,
  mode: 'normal' | 'optimized' | 'minimal'
) => {
  switch (mode) {
    case 'minimal':
      return `${baseClass} ${minimalClass}`;
    case 'optimized':
      return `${baseClass} ${optimizedClass}`;
    case 'normal':
    default:
      return baseClass;
  }
};

// Virtual scrolling utilities
export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  totalItems: number;
}

export const useVirtualScroll = ({
  itemHeight,
  containerHeight,
  overscan = 5,
  totalItems,
}: VirtualScrollOptions) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = {
    start: Math.max(0, Math.floor(scrollTop / itemHeight) - overscan),
    end: Math.min(
      totalItems - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    ),
  };

  const visibleItems = visibleRange.end - visibleRange.start + 1;
  const totalHeight = totalItems * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleRange,
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
  };
};

// Cleanup utilities for component unmounting
export const useCleanupOnUnmount = (cleanupFn: () => void) => {
  useEffect(() => {
    return cleanupFn;
  }, [cleanupFn]);
};