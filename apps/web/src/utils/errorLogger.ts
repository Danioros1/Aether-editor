/**
 * Error Logging and Reporting System
 * 
 * Centralized error logging with categorization, severity levels,
 * and context information for debugging and monitoring.
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 
  | 'api' 
  | 'ui' 
  | 'performance' 
  | 'network' 
  | 'storage' 
  | 'audio' 
  | 'video' 
  | 'browser' 
  | 'user' 
  | 'system';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  timestamp: number;
  url: string;
  userAgent: string;
  viewport: { width: number; height: number };
  memoryUsage?: {
    used: number;
    total: number;
    limit: number;
  };
  performanceMetrics?: {
    frameRate: number;
    loadTime: number;
  };
  browserFeatures?: Record<string, boolean>;
  customData?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  count: number;
  firstOccurred: number;
  lastOccurred: number;
  resolved: boolean;
  tags: string[];
}

class ErrorLogger {
  private errors: Map<string, ErrorReport> = new Map();
  private listeners: Array<(error: ErrorReport) => void> = [];
  private sessionId: string;
  private maxErrors = 1000; // Prevent memory leaks
  private reportingEnabled = true;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        category: 'system',
        severity: 'high',
        tags: ['uncaught', 'javascript'],
        customData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        category: 'system',
        severity: 'high',
        tags: ['uncaught', 'promise'],
        customData: {
          reason: event.reason
        }
      });
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        this.logError({
          message: `Resource failed to load: ${target.tagName}`,
          category: 'network',
          severity: 'medium',
          tags: ['resource', 'loading'],
          customData: {
            tagName: target.tagName,
            src: (target as any).src || (target as any).href,
            outerHTML: target.outerHTML
          }
        });
      }
    }, true);
  }

  /**
   * Get current context information
   */
  private getContext(customData?: Record<string, any>): ErrorContext {
    const context: ErrorContext = {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      url: (typeof window !== 'undefined' && window.location) ? window.location.href : 'test://localhost',
      userAgent: (typeof navigator !== 'undefined') ? navigator.userAgent : 'Test Environment',
      viewport: {
        width: (typeof window !== 'undefined') ? window.innerWidth : 1024,
        height: (typeof window !== 'undefined') ? window.innerHeight : 768
      },
      customData
    };

    // Add memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      context.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }

    // Add browser features
    context.browserFeatures = {
      webgl: this.checkWebGLSupport(),
      audioContext: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
      intersectionObserver: typeof IntersectionObserver !== 'undefined',
      resizeObserver: typeof ResizeObserver !== 'undefined',
      matchMedia: typeof window.matchMedia !== 'undefined',
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined'
    };

    return context;
  }

  /**
   * Check WebGL support
   */
  private checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  }

  /**
   * Generate error ID based on message and stack
   */
  private generateErrorId(message: string, stack?: string): string {
    const content = `${message}${stack || ''}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `error_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Log an error with context
   */
  logError(options: {
    message: string;
    stack?: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    tags?: string[];
    customData?: Record<string, any>;
  }): string {
    if (!this.reportingEnabled) {
      return '';
    }

    const { message, stack, category, severity, tags = [], customData } = options;
    const errorId = this.generateErrorId(message, stack);
    const now = Date.now();
    const context = this.getContext(customData);

    let errorReport: ErrorReport;

    if (this.errors.has(errorId)) {
      // Update existing error
      errorReport = this.errors.get(errorId)!;
      errorReport.count++;
      errorReport.lastOccurred = now;
      errorReport.context = context; // Update with latest context
    } else {
      // Create new error report
      errorReport = {
        id: errorId,
        message,
        stack,
        category,
        severity,
        context,
        count: 1,
        firstOccurred: now,
        lastOccurred: now,
        resolved: false,
        tags: [...tags]
      };

      this.errors.set(errorId, errorReport);

      // Prevent memory leaks by limiting stored errors
      if (this.errors.size > this.maxErrors) {
        const oldestError = Array.from(this.errors.values())
          .sort((a, b) => a.firstOccurred - b.firstOccurred)[0];
        this.errors.delete(oldestError.id);
      }
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(errorReport);
      } catch (error) {
        console.error('Error in error logger listener:', error);
      }
    });

    // Console logging based on severity
    this.logToConsole(errorReport);

    return errorId;
  }

  /**
   * Log to console based on severity
   */
  private logToConsole(error: ErrorReport): void {
    const prefix = `[${error.category.toUpperCase()}] ${error.severity.toUpperCase()}:`;
    const details = {
      message: error.message,
      count: error.count,
      tags: error.tags,
      context: error.context
    };

    switch (error.severity) {
      case 'critical':
        console.error(prefix, details);
        break;
      case 'high':
        console.error(prefix, details);
        break;
      case 'medium':
        console.warn(prefix, details);
        break;
      case 'low':
        console.info(prefix, details);
        break;
    }
  }

  /**
   * Add error listener
   */
  addListener(listener: (error: ErrorReport) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get all error reports
   */
  getErrors(): ErrorReport[] {
    return Array.from(this.errors.values()).sort((a, b) => b.lastOccurred - a.lastOccurred);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): ErrorReport[] {
    return this.getErrors().filter(error => error.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorReport[] {
    return this.getErrors().filter(error => error.severity === severity);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    resolved: number;
    unresolved: number;
  } {
    const errors = this.getErrors();
    const stats = {
      total: errors.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      resolved: 0,
      unresolved: 0
    };

    errors.forEach(error => {
      // Count by category
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // Count resolved/unresolved
      if (error.resolved) {
        stats.resolved++;
      } else {
        stats.unresolved++;
      }
    });

    return stats;
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors.clear();
  }

  /**
   * Clear resolved errors
   */
  clearResolvedErrors(): void {
    for (const [id, error] of this.errors.entries()) {
      if (error.resolved) {
        this.errors.delete(id);
      }
    }
  }

  /**
   * Export errors for external reporting
   */
  exportErrors(): {
    sessionId: string;
    exportTime: number;
    errors: ErrorReport[];
    stats: ReturnType<typeof this.getErrorStats>;
  } {
    return {
      sessionId: this.sessionId,
      exportTime: Date.now(),
      errors: this.getErrors(),
      stats: this.getErrorStats()
    };
  }

  /**
   * Enable/disable error reporting
   */
  setReportingEnabled(enabled: boolean): void {
    this.reportingEnabled = enabled;
  }

  /**
   * Check if error reporting is enabled
   */
  isReportingEnabled(): boolean {
    return this.reportingEnabled;
  }
}

// Create singleton instance
export const errorLogger = new ErrorLogger();

// Convenience functions for common error types
export const logAPIError = (message: string, customData?: Record<string, any>) => {
  return errorLogger.logError({
    message,
    category: 'api',
    severity: 'medium',
    tags: ['api'],
    customData
  });
};

export const logNetworkError = (message: string, customData?: Record<string, any>) => {
  return errorLogger.logError({
    message,
    category: 'network',
    severity: 'medium',
    tags: ['network'],
    customData
  });
};

export const logUIError = (message: string, customData?: Record<string, any>) => {
  return errorLogger.logError({
    message,
    category: 'ui',
    severity: 'low',
    tags: ['ui'],
    customData
  });
};

export const logPerformanceError = (message: string, customData?: Record<string, any>) => {
  return errorLogger.logError({
    message,
    category: 'performance',
    severity: 'medium',
    tags: ['performance'],
    customData
  });
};

export const logCriticalError = (message: string, category: ErrorCategory, customData?: Record<string, any>) => {
  return errorLogger.logError({
    message,
    category,
    severity: 'critical',
    tags: ['critical'],
    customData
  });
};

// React error boundary integration
export const logReactError = (error: Error, errorInfo: { componentStack: string }) => {
  return errorLogger.logError({
    message: `React Error: ${error.message}`,
    stack: error.stack,
    category: 'ui',
    severity: 'high',
    tags: ['react', 'component'],
    customData: {
      componentStack: errorInfo.componentStack
    }
  });
};