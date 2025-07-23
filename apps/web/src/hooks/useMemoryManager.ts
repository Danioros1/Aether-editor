// React hook for memory management
import { useState, useEffect, useCallback } from 'react';
import { memoryManager, MemoryUsageReport, MemoryCleanupResult } from '../utils/memoryManager';

export interface UseMemoryManagerReturn {
  // Current state
  memoryReport: MemoryUsageReport | null;
  memoryHistory: MemoryUsageReport[];
  isMonitoring: boolean;
  
  // Actions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  performCleanup: (aggressive?: boolean) => Promise<MemoryCleanupResult>;
  trackMemoryUsage: (category: string, itemId: string, sizeBytes: number, priority?: number) => void;
  untrackMemoryUsage: (category: string, itemId: string) => void;
  touchMemoryItem: (category: string, itemId: string) => void;
  
  // Statistics
  memoryStats: {
    totalTracked: number;
    categoryStats: Array<{
      category: string;
      currentSize: number;
      maxSize: number;
      itemCount: number;
      utilizationPercent: number;
    }>;
  };
}

export const useMemoryManager = (): UseMemoryManagerReturn => {
  const [memoryReport, setMemoryReport] = useState<MemoryUsageReport | null>(null);
  const [memoryHistory, setMemoryHistory] = useState<MemoryUsageReport[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [memoryStats, setMemoryStats] = useState(memoryManager.getMemoryStats());

  // Update memory stats periodically
  useEffect(() => {
    const updateStats = () => {
      setMemoryStats(memoryManager.getMemoryStats());
      setMemoryHistory(memoryManager.getMemoryHistory());
    };

    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, []);

  // Listen for memory reports
  useEffect(() => {
    const handleMemoryReport = (event: CustomEvent<MemoryUsageReport>) => {
      setMemoryReport(event.detail);
    };

    window.addEventListener('memory:report', handleMemoryReport as EventListener);
    return () => window.removeEventListener('memory:report', handleMemoryReport as EventListener);
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    memoryManager.startMonitoring();
    setIsMonitoring(true);
  }, []);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    memoryManager.stopMonitoring();
    setIsMonitoring(false);
  }, []);

  // Perform cleanup
  const performCleanup = useCallback(async (aggressive: boolean = false): Promise<MemoryCleanupResult> => {
    if (aggressive) {
      return await memoryManager.performAggressiveCleanup();
    } else {
      return await memoryManager.performStandardCleanup();
    }
  }, []);

  // Track memory usage
  const trackMemoryUsage = useCallback((category: string, itemId: string, sizeBytes: number, priority: number = 1) => {
    memoryManager.trackMemoryUsage(category, itemId, sizeBytes, priority);
  }, []);

  // Untrack memory usage
  const untrackMemoryUsage = useCallback((category: string, itemId: string) => {
    memoryManager.untrackMemoryUsage(category, itemId);
  }, []);

  // Touch memory item (update last accessed time)
  const touchMemoryItem = useCallback((category: string, itemId: string) => {
    memoryManager.touchMemoryItem(category, itemId);
  }, []);

  return {
    // Current state
    memoryReport,
    memoryHistory,
    isMonitoring,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    performCleanup,
    trackMemoryUsage,
    untrackMemoryUsage,
    touchMemoryItem,
    
    // Statistics
    memoryStats,
  };
};

// Hook for components that need to track their memory usage
export const useMemoryTracking = (category: string, itemId: string) => {
  const { trackMemoryUsage, untrackMemoryUsage, touchMemoryItem } = useMemoryManager();

  const trackSize = useCallback((sizeBytes: number, priority: number = 1) => {
    trackMemoryUsage(category, itemId, sizeBytes, priority);
  }, [category, itemId, trackMemoryUsage]);

  const untrack = useCallback(() => {
    untrackMemoryUsage(category, itemId);
  }, [category, itemId, untrackMemoryUsage]);

  const touch = useCallback(() => {
    touchMemoryItem(category, itemId);
  }, [category, itemId, touchMemoryItem]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      untrack();
    };
  }, [untrack]);

  return {
    trackSize,
    untrack,
    touch,
  };
};

// Hook for automatic memory cleanup based on component lifecycle
export const useAutoMemoryCleanup = (category: string, cleanupCallback: () => Promise<number>) => {
  useEffect(() => {
    // Register cleanup callback
    memoryManager.registerCleanupCallback(category, cleanupCallback);

    // Listen for cleanup requests
    const handleCleanup = async (event: CustomEvent) => {
      const { category: targetCategory } = event.detail;
      if (targetCategory === category || targetCategory === 'all') {
        try {
          await cleanupCallback();
        } catch (error) {
          console.warn(`Cleanup failed for ${category}:`, error);
        }
      }
    };

    window.addEventListener('memory:cleanup', handleCleanup as any);
    
    return () => {
      window.removeEventListener('memory:cleanup', handleCleanup as any);
    };
  }, [category, cleanupCallback]);
};