/**
 * Error Logger Hook
 * 
 * React hook for integrating with the error logging system.
 * Provides error reporting functions and error state management.
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  errorLogger, 
  ErrorReport, 
  ErrorCategory, 
  ErrorSeverity,
  logAPIError,
  logNetworkError,
  logUIError,
  logPerformanceError,
  logCriticalError
} from '@/utils/errorLogger';
import { useToast } from '@/hooks/use-toast';

export interface UseErrorLoggerOptions {
  showToastOnError?: boolean;
  autoReportCritical?: boolean;
  maxToastSeverity?: ErrorSeverity;
}

export function useErrorLogger(options: UseErrorLoggerOptions = {}) {
  const {
    showToastOnError = true,
    autoReportCritical = true,
    maxToastSeverity = 'high'
  } = options;

  const { toast } = useToast();
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [errorStats, setErrorStats] = useState(errorLogger.getErrorStats());

  // Update errors and stats when new errors occur
  useEffect(() => {
    const updateErrorState = () => {
      setErrors(errorLogger.getErrors());
      setErrorStats(errorLogger.getErrorStats());
    };

    // Initial load
    updateErrorState();

    // Listen for new errors
    const removeListener = errorLogger.addListener((error) => {
      updateErrorState();

      // Show toast notification if enabled
      if (showToastOnError && shouldShowToast(error.severity)) {
        showErrorToast(error);
      }

      // Auto-report critical errors
      if (autoReportCritical && error.severity === 'critical') {
        // This could integrate with external error reporting services
        console.error('Critical error auto-reported:', error);
      }
    });

    return removeListener;
  }, [showToastOnError, autoReportCritical, maxToastSeverity, toast]);

  // Determine if toast should be shown based on severity
  const shouldShowToast = useCallback((severity: ErrorSeverity): boolean => {
    const severityLevels: Record<ErrorSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };

    return severityLevels[severity] >= severityLevels[maxToastSeverity];
  }, [maxToastSeverity]);

  // Show error toast notification
  const showErrorToast = useCallback((error: ErrorReport) => {
    const getToastVariant = (severity: ErrorSeverity) => {
      switch (severity) {
        case 'critical':
        case 'high':
          return 'destructive';
        case 'medium':
          return 'default';
        case 'low':
          return 'default';
      }
    };

    const getToastTitle = (error: ErrorReport) => {
      switch (error.severity) {
        case 'critical':
          return 'Critical Error';
        case 'high':
          return 'Error';
        case 'medium':
          return 'Warning';
        case 'low':
          return 'Notice';
      }
    };

    toast({
      title: getToastTitle(error),
      description: error.message,
      variant: getToastVariant(error.severity),
      duration: error.severity === 'critical' ? 10000 : 5000
    });
  }, [toast]);

  // Convenience functions for logging different types of errors
  const logError = useCallback((options: {
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    tags?: string[];
    customData?: Record<string, any>;
  }) => {
    return errorLogger.logError(options);
  }, []);

  const logAPI = useCallback((message: string, customData?: Record<string, any>) => {
    return logAPIError(message, customData);
  }, []);

  const logNetwork = useCallback((message: string, customData?: Record<string, any>) => {
    return logNetworkError(message, customData);
  }, []);

  const logUI = useCallback((message: string, customData?: Record<string, any>) => {
    return logUIError(message, customData);
  }, []);

  const logPerformance = useCallback((message: string, customData?: Record<string, any>) => {
    return logPerformanceError(message, customData);
  }, []);

  const logCritical = useCallback((message: string, category: ErrorCategory, customData?: Record<string, any>) => {
    return logCriticalError(message, category, customData);
  }, []);

  // Error management functions
  const resolveError = useCallback((errorId: string) => {
    const resolved = errorLogger.resolveError(errorId);
    if (resolved) {
      setErrors(errorLogger.getErrors());
      setErrorStats(errorLogger.getErrorStats());
    }
    return resolved;
  }, []);

  const clearErrors = useCallback(() => {
    errorLogger.clearErrors();
    setErrors([]);
    setErrorStats(errorLogger.getErrorStats());
  }, []);

  const clearResolvedErrors = useCallback(() => {
    errorLogger.clearResolvedErrors();
    setErrors(errorLogger.getErrors());
    setErrorStats(errorLogger.getErrorStats());
  }, []);

  const exportErrors = useCallback(() => {
    return errorLogger.exportErrors();
  }, []);

  // Filter functions
  const getErrorsByCategory = useCallback((category: ErrorCategory) => {
    return errorLogger.getErrorsByCategory(category);
  }, []);

  const getErrorsBySeverity = useCallback((severity: ErrorSeverity) => {
    return errorLogger.getErrorsBySeverity(severity);
  }, []);

  const getCriticalErrors = useCallback(() => {
    return getErrorsBySeverity('critical');
  }, [getErrorsBySeverity]);

  const getUnresolvedErrors = useCallback(() => {
    return errors.filter(error => !error.resolved);
  }, [errors]);

  return {
    // Error data
    errors,
    errorStats,
    
    // Logging functions
    logError,
    logAPI,
    logNetwork,
    logUI,
    logPerformance,
    logCritical,
    
    // Management functions
    resolveError,
    clearErrors,
    clearResolvedErrors,
    exportErrors,
    
    // Filter functions
    getErrorsByCategory,
    getErrorsBySeverity,
    getCriticalErrors,
    getUnresolvedErrors,
    
    // Utility functions
    hasErrors: errors.length > 0,
    hasCriticalErrors: errorStats.bySeverity.critical > 0,
    hasUnresolvedErrors: errorStats.unresolved > 0
  };
}

/**
 * Hook for handling async operations with automatic error logging
 */
export function useAsyncErrorHandler() {
  const { logError } = useErrorLogger();

  const handleAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    options: {
      category: ErrorCategory;
      severity?: ErrorSeverity;
      customData?: Record<string, any>;
      fallback?: T;
    }
  ): Promise<T | undefined> => {
    const { category, severity = 'medium', customData, fallback } = options;

    try {
      return await asyncFn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      logError({
        message: `Async operation failed: ${message}`,
        category,
        severity,
        tags: ['async', 'promise'],
        customData: {
          ...customData,
          originalError: error,
          stack
        }
      });

      return fallback;
    }
  }, [logError]);

  return { handleAsync };
}

/**
 * Hook for component-level error boundaries
 */
export function useComponentErrorHandler(componentName: string) {
  const { logError } = useErrorLogger();

  const handleComponentError = useCallback((error: Error, errorInfo?: { componentStack?: string }) => {
    logError({
      message: `Component error in ${componentName}: ${error.message}`,
      category: 'ui',
      severity: 'high',
      tags: ['component', 'react'],
      customData: {
        componentName,
        componentStack: errorInfo?.componentStack,
        stack: error.stack
      }
    });
  }, [componentName, logError]);

  return { handleComponentError };
}