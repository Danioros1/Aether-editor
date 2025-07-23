import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceMonitor } from '../performanceMonitor';
import { setupBrowserAPIMocks, isTestEnvironment } from '../testEnvironment';

// Setup browser API mocks for consistent testing
setupBrowserAPIMocks();

describe('Performance Monitor', () => {
  beforeEach(() => {
    // Reset performance monitor state
    performanceMonitor.stopMonitoring();
  });

  afterEach(() => {
    performanceMonitor.stopMonitoring();
  });

  it('should start and stop monitoring', () => {
    expect(() => {
      performanceMonitor.startMonitoring();
      performanceMonitor.stopMonitoring();
    }).not.toThrow();
  });

  it('should get current metrics', () => {
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics).toHaveProperty('memoryUsage');
    expect(metrics).toHaveProperty('renderingMetrics');
    expect(metrics).toHaveProperty('componentMetrics');
    
    expect(metrics.memoryUsage).toHaveProperty('usedJSHeapSize');
    expect(metrics.memoryUsage).toHaveProperty('totalJSHeapSize');
    expect(metrics.memoryUsage).toHaveProperty('jsHeapSizeLimit');
  });

  it('should measure component render time', () => {
    const testFunction = () => {
      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      return sum;
    };

    const result = performanceMonitor.measureComponentRender('timelineRenderTime', testFunction);
    
    expect(result).toBe(499500); // Sum of 0 to 999
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.componentMetrics.timelineRenderTime).toBeGreaterThan(0);
  });

  it('should measure async component render time', async () => {
    const testAsyncFunction = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'completed';
    };

    const result = await performanceMonitor.measureAsyncComponentRender('previewRenderTime', testAsyncFunction);
    
    expect(result).toBe('completed');
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.componentMetrics.previewRenderTime).toBeGreaterThan(0);
  });

  it('should get memory usage in MB', () => {
    const memoryUsage = performanceMonitor.getMemoryUsageMB();
    expect(memoryUsage).toBeGreaterThan(0);
    expect(typeof memoryUsage).toBe('number');
    
    // In test environment, should return consistent mock value
    if (isTestEnvironment()) {
      expect(memoryUsage).toBe(50); // Mock value from test environment
    }
  });

  it('should get frame rate', () => {
    const frameRate = performanceMonitor.getFrameRate();
    expect(frameRate).toBeGreaterThan(0);
    expect(typeof frameRate).toBe('number');
  });

  it('should determine performance status', () => {
    const status = performanceMonitor.getPerformanceStatus();
    expect(['good', 'warning', 'critical']).toContain(status);
  });

  it('should check if performance is healthy', () => {
    const isHealthy = performanceMonitor.isPerformanceHealthy();
    expect(typeof isHealthy).toBe('boolean');
  });

  it('should update thresholds', () => {
    const newThresholds = {
      memoryWarning: 150,
      memoryCritical: 300
    };

    expect(() => {
      performanceMonitor.updateThresholds(newThresholds);
    }).not.toThrow();
  });

  it('should handle performance events', () => {
    const eventSpy = vi.spyOn(window, 'dispatchEvent');
    
    performanceMonitor.startMonitoring();
    
    // Wait a bit for monitoring to potentially trigger events
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        performanceMonitor.stopMonitoring();
        
        // In normal test conditions, we don't expect performance events to be triggered
        // Just verify the monitoring system can start and stop without errors
        expect(eventSpy).toHaveBeenCalledTimes(0);
        
        eventSpy.mockRestore();
        resolve();
      }, 100);
    });
  });
});