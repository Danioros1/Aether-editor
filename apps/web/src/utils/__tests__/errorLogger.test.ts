/**
 * Error Logger Tests
 * 
 * Tests for the centralized error logging and reporting system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  errorLogger, 
  logAPIError, 
  logNetworkError, 
  logUIError, 
  logPerformanceError, 
  logCriticalError,
  logReactError
} from '../errorLogger';

// Mock window and performance objects
const mockWindow = {
  location: { href: 'http://localhost:3000/test' },
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
} as any;

const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)'
} as any;

const mockPerformance = {
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024,
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024
  }
} as any;

const mockDocument = {
  createElement: vi.fn(() => ({
    getContext: vi.fn(() => ({}))
  }))
} as any;

describe('Error Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock global objects
    Object.defineProperty(global, 'window', { value: mockWindow, writable: true });
    Object.defineProperty(global, 'navigator', { value: mockNavigator, writable: true });
    Object.defineProperty(global, 'performance', { value: mockPerformance, writable: true });
    Object.defineProperty(global, 'document', { value: mockDocument, writable: true });
    
    // Clear any existing errors
    errorLogger.clearErrors();
  });

  afterEach(() => {
    errorLogger.clearErrors();
  });

  describe('Basic error logging', () => {
    it('should log an error with all required fields', () => {
      const errorId = errorLogger.logError({
        message: 'Test error message',
        category: 'ui',
        severity: 'medium',
        tags: ['test'],
        customData: { testData: 'value' }
      });

      expect(errorId).toBeTruthy();
      
      const errors = errorLogger.getErrors();
      expect(errors).toHaveLength(1);
      
      const error = errors[0];
      expect(error.message).toBe('Test error message');
      expect(error.category).toBe('ui');
      expect(error.severity).toBe('medium');
      expect(error.tags).toContain('test');
      expect(error.context.customData?.testData).toBe('value');
    });

    it('should generate unique error IDs', () => {
      const errorId1 = errorLogger.logError({
        message: 'Error 1',
        category: 'api',
        severity: 'low'
      });

      const errorId2 = errorLogger.logError({
        message: 'Error 2',
        category: 'api',
        severity: 'low'
      });

      expect(errorId1).not.toBe(errorId2);
    });

    it('should increment count for duplicate errors', () => {
      const message = 'Duplicate error';
      
      errorLogger.logError({
        message,
        category: 'network',
        severity: 'medium'
      });

      errorLogger.logError({
        message,
        category: 'network',
        severity: 'medium'
      });

      const errors = errorLogger.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].count).toBe(2);
    });

    it('should include context information', () => {
      errorLogger.logError({
        message: 'Test error',
        category: 'system',
        severity: 'high'
      });

      const errors = errorLogger.getErrors();
      const error = errors[0];
      
      expect(error.context.url).toBe('http://localhost:3000/test');
      expect(error.context.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      expect(error.context.viewport.width).toBe(1024);
      expect(error.context.viewport.height).toBe(768);
      expect(error.context.memoryUsage?.used).toBe(50 * 1024 * 1024);
    });
  });

  describe('Error categorization and filtering', () => {
    beforeEach(() => {
      // Add test errors
      errorLogger.logError({ message: 'API Error', category: 'api', severity: 'high' });
      errorLogger.logError({ message: 'Network Error', category: 'network', severity: 'medium' });
      errorLogger.logError({ message: 'UI Error', category: 'ui', severity: 'low' });
      errorLogger.logError({ message: 'Critical Error', category: 'system', severity: 'critical' });
    });

    it('should filter errors by category', () => {
      const apiErrors = errorLogger.getErrorsByCategory('api');
      expect(apiErrors).toHaveLength(1);
      expect(apiErrors[0].message).toBe('API Error');

      const networkErrors = errorLogger.getErrorsByCategory('network');
      expect(networkErrors).toHaveLength(1);
      expect(networkErrors[0].message).toBe('Network Error');
    });

    it('should filter errors by severity', () => {
      const criticalErrors = errorLogger.getErrorsBySeverity('critical');
      expect(criticalErrors).toHaveLength(1);
      expect(criticalErrors[0].message).toBe('Critical Error');

      const highErrors = errorLogger.getErrorsBySeverity('high');
      expect(highErrors).toHaveLength(1);
      expect(highErrors[0].message).toBe('API Error');
    });

    it('should provide error statistics', () => {
      const stats = errorLogger.getErrorStats();
      
      expect(stats.total).toBe(4);
      expect(stats.byCategory.api).toBe(1);
      expect(stats.byCategory.network).toBe(1);
      expect(stats.byCategory.ui).toBe(1);
      expect(stats.byCategory.system).toBe(1);
      expect(stats.bySeverity.critical).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.bySeverity.low).toBe(1);
      expect(stats.unresolved).toBe(4);
      expect(stats.resolved).toBe(0);
    });
  });

  describe('Error management', () => {
    it('should mark errors as resolved', () => {
      const errorId = errorLogger.logError({
        message: 'Test error',
        category: 'ui',
        severity: 'medium'
      });

      const resolved = errorLogger.resolveError(errorId);
      expect(resolved).toBe(true);

      const errors = errorLogger.getErrors();
      expect(errors[0].resolved).toBe(true);

      const stats = errorLogger.getErrorStats();
      expect(stats.resolved).toBe(1);
      expect(stats.unresolved).toBe(0);
    });

    it('should clear all errors', () => {
      errorLogger.logError({ message: 'Error 1', category: 'api', severity: 'low' });
      errorLogger.logError({ message: 'Error 2', category: 'ui', severity: 'medium' });

      expect(errorLogger.getErrors()).toHaveLength(2);

      errorLogger.clearErrors();
      expect(errorLogger.getErrors()).toHaveLength(0);
    });

    it('should clear only resolved errors', () => {
      const errorId1 = errorLogger.logError({ message: 'Error 1', category: 'api', severity: 'low' });
      const errorId2 = errorLogger.logError({ message: 'Error 2', category: 'ui', severity: 'medium' });

      errorLogger.resolveError(errorId1);

      errorLogger.clearResolvedErrors();

      const errors = errorLogger.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Error 2');
    });
  });

  describe('Error listeners', () => {
    it('should notify listeners when errors occur', () => {
      const listener = vi.fn();
      const removeListener = errorLogger.addListener(listener);

      errorLogger.logError({
        message: 'Test error',
        category: 'network',
        severity: 'high'
      });

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
          category: 'network',
          severity: 'high'
        })
      );

      removeListener();

      errorLogger.logError({
        message: 'Another error',
        category: 'api',
        severity: 'medium'
      });

      expect(listener).toHaveBeenCalledOnce(); // Should not be called again
    });

    it('should handle listener errors gracefully', () => {
      const faultyListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      errorLogger.addListener(faultyListener);

      // Should not throw when listener fails
      expect(() => {
        errorLogger.logError({
          message: 'Test error',
          category: 'ui',
          severity: 'low'
        });
      }).not.toThrow();

      expect(faultyListener).toHaveBeenCalled();
    });
  });

  describe('Error export', () => {
    it('should export errors with metadata', () => {
      errorLogger.logError({ message: 'Error 1', category: 'api', severity: 'high' });
      errorLogger.logError({ message: 'Error 2', category: 'ui', severity: 'medium' });

      const exportData = errorLogger.exportErrors();

      expect(exportData).toHaveProperty('sessionId');
      expect(exportData).toHaveProperty('exportTime');
      expect(exportData).toHaveProperty('errors');
      expect(exportData).toHaveProperty('stats');
      expect(exportData.errors).toHaveLength(2);
      expect(exportData.stats.total).toBe(2);
    });
  });

  describe('Convenience functions', () => {
    it('should log API errors', () => {
      const errorId = logAPIError('API request failed', { endpoint: '/api/test' });
      
      expect(errorId).toBeTruthy();
      
      const errors = errorLogger.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].category).toBe('api');
      expect(errors[0].severity).toBe('medium');
      expect(errors[0].tags).toContain('api');
    });

    it('should log network errors', () => {
      const errorId = logNetworkError('Network timeout', { timeout: 5000 });
      
      const errors = errorLogger.getErrors();
      expect(errors[0].category).toBe('network');
      expect(errors[0].tags).toContain('network');
    });

    it('should log UI errors', () => {
      const errorId = logUIError('Component render failed');
      
      const errors = errorLogger.getErrors();
      expect(errors[0].category).toBe('ui');
      expect(errors[0].severity).toBe('low');
    });

    it('should log performance errors', () => {
      const errorId = logPerformanceError('Memory usage high');
      
      const errors = errorLogger.getErrors();
      expect(errors[0].category).toBe('performance');
      expect(errors[0].tags).toContain('performance');
    });

    it('should log critical errors', () => {
      const errorId = logCriticalError('System failure', 'system');
      
      const errors = errorLogger.getErrors();
      expect(errors[0].severity).toBe('critical');
      expect(errors[0].tags).toContain('critical');
    });

    it('should log React errors', () => {
      const error = new Error('Component crashed');
      const errorInfo = { componentStack: 'at Component\n  at App' };
      
      const errorId = logReactError(error, errorInfo);
      
      const errors = errorLogger.getErrors();
      expect(errors[0].category).toBe('ui');
      expect(errors[0].severity).toBe('high');
      expect(errors[0].tags).toContain('react');
      expect(errors[0].context.customData?.componentStack).toBe('at Component\n  at App');
    });
  });

  describe('Error reporting control', () => {
    it('should disable error reporting when requested', () => {
      errorLogger.setReportingEnabled(false);
      expect(errorLogger.isReportingEnabled()).toBe(false);

      const errorId = errorLogger.logError({
        message: 'Test error',
        category: 'ui',
        severity: 'medium'
      });

      expect(errorId).toBe('');
      expect(errorLogger.getErrors()).toHaveLength(0);
    });

    it('should re-enable error reporting', () => {
      errorLogger.setReportingEnabled(false);
      errorLogger.setReportingEnabled(true);
      expect(errorLogger.isReportingEnabled()).toBe(true);

      errorLogger.logError({
        message: 'Test error',
        category: 'ui',
        severity: 'medium'
      });

      expect(errorLogger.getErrors()).toHaveLength(1);
    });
  });
});