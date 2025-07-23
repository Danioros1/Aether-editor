// Performance optimization system tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceOptimizer } from '../../utils/performanceOptimizer';
import { memoryManager } from '../../utils/memoryManager';
import { performanceMonitor } from '../../utils/performanceMonitor';

// Mock performance APIs
const mockPerformanceMemory = {
  usedJSHeapSize: 100 * 1024 * 1024, // 100MB
  totalJSHeapSize: 200 * 1024 * 1024, // 200MB
  jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
};

Object.defineProperty(performance, 'memory', {
  value: mockPerformanceMemory,
  writable: true,
});

describe('Performance Optimization System', () => {
  beforeEach(() => {
    // Reset performance optimizer
    performanceOptimizer.resetToNormal();
    
    // Start monitoring
    performanceMonitor.startMonitoring();
    memoryManager.startMonitoring();
  });

  afterEach(() => {
    // Stop monitoring
    performanceMonitor.stopMonitoring();
    memoryManager.stopMonitoring();
    
    // Clear any timers
    vi.clearAllTimers();
  });

  describe('Performance Optimizer', () => {
    it('should start in normal mode', () => {
      expect(performanceOptimizer.getCurrentMode()).toBe('normal');
    });

    it('should switch to optimized mode on high memory usage', async () => {
      // Mock high memory usage
      mockPerformanceMemory.usedJSHeapSize = 180 * 1024 * 1024; // 180MB
      
      // Trigger analysis
      performanceOptimizer.analyzeNow();
      
      // Wait for mode change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(performanceOptimizer.getCurrentMode()).toBe('optimized');
    });

    it('should switch to minimal mode on critical memory usage', async () => {
      // Mock critical memory usage
      mockPerformanceMemory.usedJSHeapSize = 280 * 1024 * 1024; // 280MB
      
      // Trigger analysis
      performanceOptimizer.analyzeNow();
      
      // Wait for mode change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(performanceOptimizer.getCurrentMode()).toBe('minimal');
    });

    it('should provide performance status', () => {
      const status = performanceOptimizer.getPerformanceStatus();
      
      expect(status).toHaveProperty('mode');
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('issues');
      expect(status).toHaveProperty('suggestions');
    });

    it('should track optimization history', () => {
      performanceOptimizer.setPerformanceMode('optimized', 'Test reason');
      
      const history = performanceOptimizer.getOptimizationHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].mode).toBe('optimized');
      expect(history[history.length - 1].reason).toBe('Test reason');
    });

    it('should allow disabling auto-optimization', () => {
      performanceOptimizer.setAutoOptimization(false);
      
      // Mock critical memory usage
      mockPerformanceMemory.usedJSHeapSize = 280 * 1024 * 1024;
      
      // Trigger analysis
      performanceOptimizer.analyzeNow();
      
      // Should remain in normal mode
      expect(performanceOptimizer.getCurrentMode()).toBe('normal');
    });
  });

  describe('Memory Manager', () => {
    it('should track memory usage by category', () => {
      memoryManager.trackMemoryUsage('textures', 'test-texture', 10 * 1024 * 1024, 2); // 10MB
      
      const stats = memoryManager.getMemoryStats();
      const textureCategory = stats.categoryStats.find(cat => cat.category === 'textures');
      
      expect(textureCategory).toBeDefined();
      expect(textureCategory!.currentSize).toBeCloseTo(10, 1);
      expect(textureCategory!.itemCount).toBe(1);
    });

    it('should untrack memory usage', () => {
      memoryManager.trackMemoryUsage('textures', 'test-texture', 10 * 1024 * 1024, 2);
      memoryManager.untrackMemoryUsage('textures', 'test-texture');
      
      const stats = memoryManager.getMemoryStats();
      const textureCategory = stats.categoryStats.find(cat => cat.category === 'textures');
      
      expect(textureCategory!.currentSize).toBe(0);
      expect(textureCategory!.itemCount).toBe(0);
    });

    it('should perform memory cleanup', async () => {
      // Track memory usage that exceeds the category limit to trigger cleanup
      memoryManager.trackMemoryUsage('textures', 'texture1', 80 * 1024 * 1024, 1); // 80MB
      memoryManager.trackMemoryUsage('textures', 'texture2', 60 * 1024 * 1024, 1); // 60MB (total 140MB > 100MB limit)
      
      // Register cleanup callback
      let cleanupCalled = false;
      memoryManager.registerCleanupCallback('textures', async () => {
        cleanupCalled = true;
        return 50; // Return freed memory in MB
      });
      
      // Perform cleanup
      const result = await memoryManager.performStandardCleanup();
      
      expect(cleanupCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.categories).toContain('textures');
    });

    it('should generate memory report', () => {
      const report = memoryManager.getMemoryReport();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('totalMemory');
      expect(report).toHaveProperty('usedMemory');
      expect(report).toHaveProperty('memoryPressure');
      expect(report).toHaveProperty('breakdown');
      expect(report).toHaveProperty('recommendations');
    });

    it('should calculate memory pressure correctly', () => {
      // Mock low memory usage (25% of total)
      mockPerformanceMemory.usedJSHeapSize = 50 * 1024 * 1024; // 50MB out of 200MB
      mockPerformanceMemory.totalJSHeapSize = 200 * 1024 * 1024; // 200MB total
      const lowReport = memoryManager.getMemoryReport();
      expect(lowReport.memoryPressure).toBe('low');
      
      // Mock high memory usage (85% of total - above 80% threshold)
      mockPerformanceMemory.usedJSHeapSize = 170 * 1024 * 1024; // 170MB out of 200MB
      const highReport = memoryManager.getMemoryReport();
      expect(highReport.memoryPressure).toBe('high');
      
      // Mock critical memory usage (95% of total - above 90% threshold)
      mockPerformanceMemory.usedJSHeapSize = 190 * 1024 * 1024; // 190MB out of 200MB
      const criticalReport = memoryManager.getMemoryReport();
      expect(criticalReport.memoryPressure).toBe('critical');
    });
  });

  describe('Performance Monitor Integration', () => {
    it('should provide memory usage in MB', () => {
      const memoryUsage = performanceMonitor.getMemoryUsageMB();
      expect(typeof memoryUsage).toBe('number');
      expect(memoryUsage).toBeGreaterThan(0);
    });

    it('should provide frame rate', () => {
      const frameRate = performanceMonitor.getFrameRate();
      expect(typeof frameRate).toBe('number');
      expect(frameRate).toBeGreaterThanOrEqual(0);
    });

    it('should check performance health', () => {
      const isHealthy = performanceMonitor.isPerformanceHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should provide performance status', () => {
      const status = performanceMonitor.getPerformanceStatus();
      expect(['good', 'warning', 'critical']).toContain(status);
    });

    it('should measure component render time', () => {
      const renderTime = performanceMonitor.measureComponentRender('testComponent', () => {
        // Simulate some work
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Busy wait for 10ms
        }
        return 'result';
      });
      
      expect(renderTime).toBe('result');
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.componentMetrics.testComponent).toBeGreaterThan(0);
    });
  });

  describe('Event System', () => {
    it('should dispatch performance mode change events', async () => {
      const eventPromise = new Promise<CustomEvent>((resolve) => {
        const handleModeChange = (event: CustomEvent) => {
          resolve(event);
        };
        window.addEventListener('performance:modeChange', handleModeChange as EventListener, { once: true });
      });

      performanceOptimizer.setPerformanceMode('optimized', 'Test event');
      
      const event = await eventPromise;
      expect(event.detail.mode).toBe('optimized');
      expect(event.detail.reason).toBe('Test event');
    });

    it('should dispatch memory cleanup events', async () => {
      const eventPromise = new Promise<CustomEvent>((resolve) => {
        const handleMemoryCleanup = (event: CustomEvent) => {
          resolve(event);
        };
        window.addEventListener('performance:memoryCleanup', handleMemoryCleanup as EventListener, { once: true });
      });

      // Trigger memory cleanup event
      window.dispatchEvent(new CustomEvent('performance:memoryCleanup', {
        detail: { severity: 'warning' }
      }));
      
      const event = await eventPromise;
      expect(event.detail.severity).toBe('warning');
    });

    it('should dispatch memory report events', async () => {
      const eventPromise = new Promise<CustomEvent>((resolve) => {
        const handleMemoryReport = (event: CustomEvent) => {
          resolve(event);
        };
        window.addEventListener('memory:report', handleMemoryReport as EventListener, { once: true });
      });

      // Manually trigger a memory report
      const report = memoryManager.getMemoryReport();
      window.dispatchEvent(new CustomEvent('memory:report', { detail: report }));
      
      const event = await eventPromise;
      expect(event.detail).toHaveProperty('timestamp');
      expect(event.detail).toHaveProperty('memoryPressure');
    });
  });

  describe('Performance Thresholds', () => {
    it('should use configurable thresholds', () => {
      const config = performanceOptimizer.getConfig();
      
      expect(config.memoryThresholds.warning).toBeGreaterThan(0);
      expect(config.memoryThresholds.critical).toBeGreaterThan(config.memoryThresholds.warning);
      expect(config.frameRateThresholds.warning).toBeGreaterThan(0);
      expect(config.frameRateThresholds.critical).toBeLessThan(config.frameRateThresholds.warning);
    });

    it('should allow updating thresholds', () => {
      const newConfig = {
        memoryThresholds: {
          warning: 200,
          critical: 300,
        },
      };
      
      performanceOptimizer.updateConfig(newConfig);
      
      const updatedConfig = performanceOptimizer.getConfig();
      expect(updatedConfig.memoryThresholds.warning).toBe(200);
      expect(updatedConfig.memoryThresholds.critical).toBe(300);
    });
  });
});