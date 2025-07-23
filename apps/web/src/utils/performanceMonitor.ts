// Performance monitoring utility for tracking memory usage and rendering performance
import { isTestEnvironment, safeAPICall } from './testEnvironment';

interface PerformanceMetrics {
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  renderingMetrics: {
    frameRate: number;
    averageFrameTime: number;
    droppedFrames: number;
  };
  componentMetrics: {
    timelineRenderTime: number;
    previewRenderTime: number;
    assetLibraryRenderTime: number;
  };
}

interface PerformanceThresholds {
  memoryWarning: number; // MB
  memoryCritical: number; // MB
  frameRateWarning: number; // FPS
  frameRateCritical: number; // FPS
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    memoryUsage: { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 },
    renderingMetrics: { frameRate: 60, averageFrameTime: 16.67, droppedFrames: 0 },
    componentMetrics: { timelineRenderTime: 0, previewRenderTime: 0, assetLibraryRenderTime: 0 }
  };

  private thresholds: PerformanceThresholds = {
    memoryWarning: 100, // 100MB
    memoryCritical: 200, // 200MB
    frameRateWarning: 30, // 30 FPS
    frameRateCritical: 15  // 15 FPS
  };

  private frameTimestamps: number[] = [];
  private lastCleanupTime = 0;
  private cleanupInterval = 30000; // 30 seconds
  private isMonitoring = false;
  private monitoringInterval: number | null = null;

  // Start performance monitoring
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(() => {
      this.updateMetrics();
      this.checkThresholds();
      this.performPeriodicCleanup();
    }, 1000); // Update every second

    console.log('Performance monitoring started');
  }

  // Stop performance monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Performance monitoring stopped');
  }

  // Update performance metrics
  private updateMetrics(): void {
    // Update memory metrics using safe API call
    const memoryMetrics = safeAPICall(
      'performance.memory',
      () => {
        const memory = (performance as any).memory;
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      },
      {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB default for tests
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB default for tests
        jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB default for tests
      }
    );

    this.metrics.memoryUsage = memoryMetrics;

    // Update frame rate metrics
    this.updateFrameRateMetrics();
  }

  // Update frame rate metrics
  private updateFrameRateMetrics(): void {
    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only last 60 frames for calculation
    if (this.frameTimestamps.length > 60) {
      this.frameTimestamps = this.frameTimestamps.slice(-60);
    }

    if (this.frameTimestamps.length >= 2) {
      const timeSpan = now - this.frameTimestamps[0];
      const frameCount = this.frameTimestamps.length - 1;
      
      this.metrics.renderingMetrics.frameRate = (frameCount / timeSpan) * 1000;
      this.metrics.renderingMetrics.averageFrameTime = timeSpan / frameCount;
    }
  }

  // Check performance thresholds and trigger warnings
  private checkThresholds(): void {
    const memoryMB = this.metrics.memoryUsage.usedJSHeapSize / (1024 * 1024);
    const frameRate = this.metrics.renderingMetrics.frameRate;

    // Memory warnings
    if (memoryMB > this.thresholds.memoryCritical) {
      this.triggerMemoryCleanup('critical');
    } else if (memoryMB > this.thresholds.memoryWarning) {
      this.triggerMemoryCleanup('warning');
    }

    // Frame rate warnings
    if (frameRate < this.thresholds.frameRateCritical) {
      this.optimizeRendering('critical');
    } else if (frameRate < this.thresholds.frameRateWarning) {
      this.optimizeRendering('warning');
    }
  }

  // Trigger memory cleanup based on severity
  private triggerMemoryCleanup(severity: 'warning' | 'critical'): void {
    console.warn(`Memory usage ${severity}: ${Math.round(this.metrics.memoryUsage.usedJSHeapSize / (1024 * 1024))}MB`);

    // Dispatch custom event for components to handle cleanup
    window.dispatchEvent(new CustomEvent('performance:memoryCleanup', {
      detail: { severity, metrics: this.metrics }
    }));

    // Force garbage collection if available (Chrome DevTools)
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  // Optimize rendering based on performance issues
  private optimizeRendering(severity: 'warning' | 'critical'): void {
    console.warn(`Low frame rate detected: ${Math.round(this.metrics.renderingMetrics.frameRate)}fps`);

    // Dispatch custom event for components to reduce rendering quality
    window.dispatchEvent(new CustomEvent('performance:optimizeRendering', {
      detail: { severity, metrics: this.metrics }
    }));
  }

  // Perform periodic cleanup
  private performPeriodicCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanupTime > this.cleanupInterval) {
      this.lastCleanupTime = now;
      
      // Trigger periodic cleanup event
      window.dispatchEvent(new CustomEvent('performance:periodicCleanup', {
        detail: { metrics: this.metrics }
      }));
    }
  }

  // Measure component render time
  measureComponentRender<T>(componentName: keyof PerformanceMetrics['componentMetrics'], fn: () => T): T {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();
    
    this.metrics.componentMetrics[componentName] = endTime - startTime;
    
    return result;
  }

  // Measure async component render time
  async measureAsyncComponentRender<T>(
    componentName: keyof PerformanceMetrics['componentMetrics'], 
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    
    this.metrics.componentMetrics[componentName] = endTime - startTime;
    
    return result;
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get memory usage in MB
  getMemoryUsageMB(): number {
    // Use safe API call to get memory usage with test environment fallback
    return safeAPICall(
      'performance.memory',
      () => {
        // If metrics haven't been updated yet, get current memory directly
        if (this.metrics.memoryUsage.usedJSHeapSize === 0) {
          const memory = (performance as any).memory;
          return memory.usedJSHeapSize / (1024 * 1024);
        }
        return this.metrics.memoryUsage.usedJSHeapSize / (1024 * 1024);
      },
      isTestEnvironment() ? 50 : 100 // Return consistent mock value in tests
    );
  }

  // Get current frame rate
  getFrameRate(): number {
    return this.metrics.renderingMetrics.frameRate;
  }

  // Check if performance is healthy
  isPerformanceHealthy(): boolean {
    const memoryMB = this.getMemoryUsageMB();
    const frameRate = this.getFrameRate();
    
    return memoryMB < this.thresholds.memoryWarning && frameRate > this.thresholds.frameRateWarning;
  }

  // Get performance status
  getPerformanceStatus(): 'good' | 'warning' | 'critical' {
    const memoryMB = this.getMemoryUsageMB();
    const frameRate = this.getFrameRate();
    
    if (memoryMB > this.thresholds.memoryCritical || frameRate < this.thresholds.frameRateCritical) {
      return 'critical';
    } else if (memoryMB > this.thresholds.memoryWarning || frameRate < this.thresholds.frameRateWarning) {
      return 'warning';
    } else {
      return 'good';
    }
  }

  // Update thresholds
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-start monitoring in development
if (import.meta.env.DEV) {
  performanceMonitor.startMonitoring();
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceMonitor.stopMonitoring();
  });
}