// Auto-performance optimization system
import { performanceMonitor } from './performanceMonitor';

export type PerformanceMode = 'normal' | 'optimized' | 'minimal';

export interface PerformanceOptimizationConfig {
  memoryThresholds: {
    warning: number; // MB
    critical: number; // MB
  };
  frameRateThresholds: {
    warning: number; // FPS
    critical: number; // FPS
  };
  componentThresholds: {
    renderTimeWarning: number; // ms
    renderTimeCritical: number; // ms
  };
  autoOptimization: {
    enabled: boolean;
    aggressiveMode: boolean;
    notifyUser: boolean;
  };
}

export interface OptimizationSuggestion {
  id: string;
  type: 'memory' | 'rendering' | 'component';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  action: string;
  autoApplicable: boolean;
  applied: boolean;
}

class PerformanceOptimizer {
  private currentMode: PerformanceMode = 'normal';
  private config: PerformanceOptimizationConfig = {
    memoryThresholds: {
      warning: 150, // 150MB
      critical: 250, // 250MB
    },
    frameRateThresholds: {
      warning: 25, // 25 FPS
      critical: 15, // 15 FPS
    },
    componentThresholds: {
      renderTimeWarning: 50, // 50ms
      renderTimeCritical: 100, // 100ms
    },
    autoOptimization: {
      enabled: true,
      aggressiveMode: false,
      notifyUser: true,
    },
  };

  private appliedOptimizations = new Set<string>();
  private optimizationHistory: Array<{
    timestamp: Date;
    mode: PerformanceMode;
    reason: string;
    metrics: any;
  }> = [];

  private listeners = new Set<(mode: PerformanceMode, reason: string) => void>();
  private suggestionListeners = new Set<(suggestions: OptimizationSuggestion[]) => void>();

  constructor() {
    this.startMonitoring();
  }

  // Start performance monitoring and optimization
  startMonitoring(): void {
    // Monitor performance metrics every 2 seconds
    setInterval(() => {
      this.analyzePerformance();
    }, 2000);

    // Listen to performance events from the monitor
    window.addEventListener('performance:memoryCleanup', this.handleMemoryCleanup.bind(this) as any);
    window.addEventListener('performance:optimizeRendering', this.handleRenderingOptimization.bind(this) as any);
  }

  // Analyze current performance and apply optimizations
  private analyzePerformance(): void {
    const metrics = performanceMonitor.getMetrics();
    const memoryMB = performanceMonitor.getMemoryUsageMB();
    const frameRate = performanceMonitor.getFrameRate();
    
    const suggestions: OptimizationSuggestion[] = [];
    let newMode = this.currentMode;
    let reason = '';

    // Check memory usage
    if (memoryMB > this.config.memoryThresholds.critical) {
      newMode = 'minimal';
      reason = `Critical memory usage: ${Math.round(memoryMB)}MB`;
      
      suggestions.push({
        id: 'memory-critical',
        type: 'memory',
        severity: 'critical',
        title: 'Critical Memory Usage',
        description: `Memory usage is at ${Math.round(memoryMB)}MB, which may cause performance issues.`,
        action: 'Switch to minimal performance mode',
        autoApplicable: true,
        applied: this.appliedOptimizations.has('memory-critical'),
      });
    } else if (memoryMB > this.config.memoryThresholds.warning && this.currentMode === 'normal') {
      newMode = 'optimized';
      reason = `High memory usage: ${Math.round(memoryMB)}MB`;
      
      suggestions.push({
        id: 'memory-warning',
        type: 'memory',
        severity: 'warning',
        title: 'High Memory Usage',
        description: `Memory usage is at ${Math.round(memoryMB)}MB. Consider optimizing for better performance.`,
        action: 'Switch to optimized performance mode',
        autoApplicable: true,
        applied: this.appliedOptimizations.has('memory-warning'),
      });
    }

    // Check frame rate
    if (frameRate < this.config.frameRateThresholds.critical && frameRate > 0) {
      if (newMode !== 'minimal') {
        newMode = 'minimal';
        reason = `Critical frame rate: ${Math.round(frameRate)}fps`;
      }
      
      suggestions.push({
        id: 'framerate-critical',
        type: 'rendering',
        severity: 'critical',
        title: 'Low Frame Rate',
        description: `Frame rate has dropped to ${Math.round(frameRate)}fps, which may cause stuttering.`,
        action: 'Reduce rendering quality and disable animations',
        autoApplicable: true,
        applied: this.appliedOptimizations.has('framerate-critical'),
      });
    } else if (frameRate < this.config.frameRateThresholds.warning && frameRate > 0 && this.currentMode === 'normal') {
      if (newMode === 'normal') {
        newMode = 'optimized';
        reason = `Low frame rate: ${Math.round(frameRate)}fps`;
      }
      
      suggestions.push({
        id: 'framerate-warning',
        type: 'rendering',
        severity: 'warning',
        title: 'Reduced Frame Rate',
        description: `Frame rate has dropped to ${Math.round(frameRate)}fps. Performance optimizations may help.`,
        action: 'Enable performance optimizations',
        autoApplicable: true,
        applied: this.appliedOptimizations.has('framerate-warning'),
      });
    }

    // Check component render times
    const componentMetrics = metrics.componentMetrics;
    Object.entries(componentMetrics).forEach(([componentName, renderTime]) => {
      if (renderTime > this.config.componentThresholds.renderTimeCritical) {
        suggestions.push({
          id: `component-critical-${componentName}`,
          type: 'component',
          severity: 'critical',
          title: `Slow ${componentName} Rendering`,
          description: `${componentName} is taking ${Math.round(renderTime)}ms to render, which is causing performance issues.`,
          action: 'Optimize component rendering or reduce complexity',
          autoApplicable: false,
          applied: false,
        });
      } else if (renderTime > this.config.componentThresholds.renderTimeWarning) {
        suggestions.push({
          id: `component-warning-${componentName}`,
          type: 'component',
          severity: 'warning',
          title: `${componentName} Performance`,
          description: `${componentName} is taking ${Math.round(renderTime)}ms to render. Consider optimization.`,
          action: 'Review component implementation for performance improvements',
          autoApplicable: false,
          applied: false,
        });
      }
    });

    // Apply automatic optimizations if enabled
    if (this.config.autoOptimization.enabled && newMode !== this.currentMode) {
      this.setPerformanceMode(newMode, reason, metrics);
    }

    // Notify suggestion listeners
    if (suggestions.length > 0) {
      this.suggestionListeners.forEach(listener => listener(suggestions));
    }
  }

  // Set performance mode
  setPerformanceMode(mode: PerformanceMode, reason: string = 'Manual', metrics?: any): void {
    if (mode === this.currentMode) return;

    const previousMode = this.currentMode;
    this.currentMode = mode;

    // Record optimization history
    this.optimizationHistory.push({
      timestamp: new Date(),
      mode,
      reason,
      metrics: metrics || performanceMonitor.getMetrics(),
    });

    // Limit history size
    if (this.optimizationHistory.length > 50) {
      this.optimizationHistory = this.optimizationHistory.slice(-50);
    }

    // Dispatch performance mode change event
    window.dispatchEvent(new CustomEvent('performance:modeChange', {
      detail: { 
        mode, 
        previousMode, 
        reason,
        automatic: reason !== 'Manual'
      }
    }));

    // Notify listeners
    this.listeners.forEach(listener => listener(mode, reason));

    // Show user notification if enabled
    if (this.config.autoOptimization.notifyUser && reason !== 'Manual') {
      this.showOptimizationNotification(mode, reason);
    }

    console.log(`Performance mode changed: ${previousMode} → ${mode} (${reason})`);
  }

  // Show optimization notification to user
  private showOptimizationNotification(mode: PerformanceMode, reason: string): void {
    const modeNames = {
      normal: 'Normal',
      optimized: 'Optimized',
      minimal: 'Minimal'
    };

    window.dispatchEvent(new CustomEvent('performance:notification', {
      detail: {
        type: 'optimization',
        title: `Performance Mode: ${modeNames[mode]}`,
        message: `Switched to ${modeNames[mode].toLowerCase()} performance mode due to ${reason.toLowerCase()}.`,
        mode,
        reason,
        actions: [
          {
            label: 'Disable Auto-Optimization',
            action: () => this.setAutoOptimization(false)
          },
          {
            label: 'View Details',
            action: () => this.showPerformanceDetails()
          }
        ]
      }
    }));
  }

  // Handle memory cleanup events
  private handleMemoryCleanup(event: CustomEvent): void {
    const { severity } = event.detail;
    const optimizationId = `memory-cleanup-${severity}`;
    
    if (!this.appliedOptimizations.has(optimizationId)) {
      this.appliedOptimizations.add(optimizationId);
      
      // Apply memory-specific optimizations
      this.applyMemoryOptimizations(severity);
    }
  }

  // Handle rendering optimization events
  private handleRenderingOptimization(event: CustomEvent): void {
    const { severity } = event.detail;
    const optimizationId = `rendering-${severity}`;
    
    if (!this.appliedOptimizations.has(optimizationId)) {
      this.appliedOptimizations.add(optimizationId);
      
      // Apply rendering-specific optimizations
      this.applyRenderingOptimizations(severity);
    }
  }

  // Apply memory-specific optimizations
  private applyMemoryOptimizations(severity: 'warning' | 'critical'): void {
    if (severity === 'critical') {
      // Aggressive memory cleanup
      window.dispatchEvent(new CustomEvent('performance:clearCaches', {
        detail: { aggressive: true }
      }));
      
      // Force garbage collection if available
      if ('gc' in window && typeof (window as any).gc === 'function') {
        (window as any).gc();
      }
    } else {
      // Gentle memory cleanup
      window.dispatchEvent(new CustomEvent('performance:clearCaches', {
        detail: { aggressive: false }
      }));
    }
  }

  // Apply rendering-specific optimizations
  private applyRenderingOptimizations(severity: 'warning' | 'critical'): void {
    if (severity === 'critical') {
      // Disable expensive rendering features
      window.dispatchEvent(new CustomEvent('performance:disableFeatures', {
        detail: { 
          features: ['animations', 'shadows', 'antialiasing', 'filmstrips'],
          temporary: true
        }
      }));
    } else {
      // Reduce rendering quality
      window.dispatchEvent(new CustomEvent('performance:reduceQuality', {
        detail: { level: 'moderate' }
      }));
    }
  }

  // Show performance details
  private showPerformanceDetails(): void {
    window.dispatchEvent(new CustomEvent('performance:showDetails', {
      detail: {
        currentMode: this.currentMode,
        history: this.optimizationHistory,
        metrics: performanceMonitor.getMetrics(),
        config: this.config
      }
    }));
  }

  // Get current performance mode
  getCurrentMode(): PerformanceMode {
    return this.currentMode;
  }

  // Get optimization history
  getOptimizationHistory(): typeof this.optimizationHistory {
    return [...this.optimizationHistory];
  }

  // Set auto-optimization enabled/disabled
  setAutoOptimization(enabled: boolean): void {
    this.config.autoOptimization.enabled = enabled;
    
    if (!enabled && this.currentMode !== 'normal') {
      // Reset to normal mode when auto-optimization is disabled
      this.setPerformanceMode('normal', 'Auto-optimization disabled');
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<PerformanceOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): PerformanceOptimizationConfig {
    return { ...this.config };
  }

  // Add performance mode change listener
  addModeChangeListener(listener: (mode: PerformanceMode, reason: string) => void): void {
    this.listeners.add(listener);
  }

  // Remove performance mode change listener
  removeModeChangeListener(listener: (mode: PerformanceMode, reason: string) => void): void {
    this.listeners.delete(listener);
  }

  // Add suggestion listener
  addSuggestionListener(listener: (suggestions: OptimizationSuggestion[]) => void): void {
    this.suggestionListeners.add(listener);
  }

  // Remove suggestion listener
  removeSuggestionListener(listener: (suggestions: OptimizationSuggestion[]) => void): void {
    this.suggestionListeners.delete(listener);
  }

  // Force performance analysis
  analyzeNow(): void {
    this.analyzePerformance();
  }

  // Reset to normal mode
  resetToNormal(): void {
    this.setPerformanceMode('normal', 'Manual reset');
    this.appliedOptimizations.clear();
  }

  // Get performance status
  getPerformanceStatus(): {
    mode: PerformanceMode;
    healthy: boolean;
    issues: string[];
    suggestions: number;
  } {
    const metrics = performanceMonitor.getMetrics();
    const memoryMB = performanceMonitor.getMemoryUsageMB();
    const frameRate = performanceMonitor.getFrameRate();
    
    const issues: string[] = [];
    
    if (memoryMB > this.config.memoryThresholds.critical) {
      issues.push(`Critical memory usage: ${Math.round(memoryMB)}MB`);
    } else if (memoryMB > this.config.memoryThresholds.warning) {
      issues.push(`High memory usage: ${Math.round(memoryMB)}MB`);
    }
    
    if (frameRate < this.config.frameRateThresholds.critical && frameRate > 0) {
      issues.push(`Critical frame rate: ${Math.round(frameRate)}fps`);
    } else if (frameRate < this.config.frameRateThresholds.warning && frameRate > 0) {
      issues.push(`Low frame rate: ${Math.round(frameRate)}fps`);
    }
    
    return {
      mode: this.currentMode,
      healthy: issues.length === 0,
      issues,
      suggestions: this.appliedOptimizations.size
    };
  }
}

// Create singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Auto-start in development
if (import.meta.env.DEV) {
  console.log('Performance optimizer initialized');
}