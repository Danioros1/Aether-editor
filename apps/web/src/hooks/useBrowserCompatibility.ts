/**
 * Browser Compatibility Hook
 * 
 * React hook for managing browser API compatibility and displaying
 * user notifications about missing features.
 */

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  initializeBrowserAPIFallbacks,
  isAPIAvailable,
  isFallbackApplied,
  getAPIAvailabilityReport,
  getBrowserCompatibilityWarnings,
  clearBrowserCompatibilityWarnings
} from '@/utils/browserAPIFallbacks';

export interface BrowserCompatibilityStatus {
  isInitialized: boolean;
  missingAPIs: string[];
  criticalMissing: string[];
  fallbacksApplied: string[];
  compatibilityScore: number; // 0-100 percentage
}

/**
 * Hook for managing browser compatibility and API fallbacks
 */
export function useBrowserCompatibility() {
  const [status, setStatus] = useState<BrowserCompatibilityStatus>({
    isInitialized: false,
    missingAPIs: [],
    criticalMissing: [],
    fallbacksApplied: [],
    compatibilityScore: 100
  });
  
  const { toast } = useToast();

  useEffect(() => {
    // Initialize browser API fallbacks on mount
    initializeBrowserAPIFallbacks();
    
    // Get compatibility report
    const report = getAPIAvailabilityReport();
    const apiNames = Object.keys(report);
    const availableAPIs = apiNames.filter(name => report[name].available);
    const missingAPIs = apiNames.filter(name => !report[name].available);
    const fallbacksApplied = apiNames.filter(name => report[name].fallbackApplied);
    
    // Determine critical missing APIs
    const criticalAPIs = ['WebGL', 'AudioContext'];
    const criticalMissing = missingAPIs.filter(api => criticalAPIs.includes(api));
    
    // Calculate compatibility score
    const compatibilityScore = Math.round((availableAPIs.length / apiNames.length) * 100);
    
    setStatus({
      isInitialized: true,
      missingAPIs,
      criticalMissing,
      fallbacksApplied,
      compatibilityScore
    });
    
    // Show user notifications for compatibility warnings
    const warnings = getBrowserCompatibilityWarnings();
    if (warnings.length > 0) {
      // Show a single toast with all warnings
      toast({
        title: "Browser Compatibility Notice",
        description: warnings.join('. '),
        variant: criticalMissing.length > 0 ? "destructive" : "default",
        duration: 8000
      });
      
      clearBrowserCompatibilityWarnings();
    }
    
  }, [toast]);

  return {
    ...status,
    isAPIAvailable,
    isFallbackApplied,
    refreshStatus: () => {
      const report = getAPIAvailabilityReport();
      const apiNames = Object.keys(report);
      const availableAPIs = apiNames.filter(name => report[name].available);
      const missingAPIs = apiNames.filter(name => !report[name].available);
      const fallbacksApplied = apiNames.filter(name => report[name].fallbackApplied);
      const criticalAPIs = ['WebGL', 'AudioContext'];
      const criticalMissing = missingAPIs.filter(api => criticalAPIs.includes(api));
      const compatibilityScore = Math.round((availableAPIs.length / apiNames.length) * 100);
      
      setStatus(prev => ({
        ...prev,
        missingAPIs,
        criticalMissing,
        fallbacksApplied,
        compatibilityScore
      }));
    }
  };
}

/**
 * Hook for checking specific API availability with fallback handling
 */
export function useAPIWithFallback<T>(
  apiName: string,
  primaryImplementation: () => T,
  fallbackImplementation: () => T,
  dependencies: any[] = []
): T {
  const [result, setResult] = useState<T>(() => {
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
  });

  useEffect(() => {
    try {
      if (isAPIAvailable(apiName)) {
        setResult(primaryImplementation());
      } else {
        setResult(fallbackImplementation());
      }
    } catch (error) {
      console.warn(`API call failed for ${apiName}, using fallback:`, error);
      setResult(fallbackImplementation());
    }
  }, [apiName, ...dependencies]);

  return result;
}

/**
 * Hook for responsive design with matchMedia fallback
 */
export function useMediaQuery(query: string): boolean {
  return useAPIWithFallback(
    'matchMedia',
    () => {
      const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
      
      useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        
        mediaQuery.addListener(handler);
        return () => mediaQuery.removeListener(handler);
      }, [query]);
      
      return matches;
    },
    () => {
      // Fallback: parse common queries and provide reasonable defaults
      if (query.includes('max-width: 768px')) return false; // Assume desktop
      if (query.includes('prefers-color-scheme: dark')) return false; // Assume light
      if (query.includes('prefers-reduced-motion: reduce')) return false; // Assume no reduced motion
      return false;
    },
    [query]
  );
}

/**
 * Hook for performance monitoring with fallback
 */
export function usePerformanceMonitoring() {
  return useAPIWithFallback(
    'performance.memory',
    () => {
      const getMemoryUsage = () => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          return {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit
          };
        }
        return null;
      };
      
      return { getMemoryUsage };
    },
    () => {
      const getMemoryUsage = () => ({
        used: 50 * 1024 * 1024, // 50MB fallback
        total: 100 * 1024 * 1024, // 100MB fallback
        limit: 2 * 1024 * 1024 * 1024 // 2GB fallback
      });
      
      return { getMemoryUsage };
    }
  );
}

/**
 * Hook for audio context with fallback
 */
export function useAudioContext() {
  return useAPIWithFallback(
    'AudioContext',
    () => {
      const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
      
      useEffect(() => {
        try {
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          setAudioContext(context);
          
          return () => {
            if (context.state !== 'closed') {
              context.close();
            }
          };
        } catch (error) {
          console.warn('Failed to create AudioContext:', error);
          setAudioContext(null);
        }
      }, []);
      
      return audioContext;
    },
    () => {
      // Return null for fallback - components should handle gracefully
      return null;
    }
  );
}