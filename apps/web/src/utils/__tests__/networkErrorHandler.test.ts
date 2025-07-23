/**
 * Network Error Handler Tests
 * 
 * Tests for the network error handling system with retry mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { networkErrorHandler, NetworkError } from '../networkErrorHandler';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock navigator
const mockNavigator = {
  onLine: true
} as any;
Object.defineProperty(global, 'navigator', { value: mockNavigator, writable: true });

// Mock window
const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
} as any;
Object.defineProperty(global, 'window', { value: mockWindow, writable: true });

// Mock AbortSignal.timeout (not available in test environment)
if (!AbortSignal.timeout) {
  AbortSignal.timeout = vi.fn((timeout: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  });
}

describe('Network Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigator.onLine = true;
    
    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    // Clean up any timers
    vi.clearAllTimers();
  });

  describe('Basic fetch functionality', () => {
    it('should make successful requests', async () => {
      const mockResponse = new Response('{"success": true}', {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      });
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await networkErrorHandler.fetch('https://api.example.com/test');
      
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('should handle JSON responses', async () => {
      const testData = { message: 'Hello, World!' };
      const mockResponse = new Response(JSON.stringify(testData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
      mockFetch.mockResolvedValueOnce(mockResponse);

      const data = await networkErrorHandler.fetchJSON('https://api.example.com/test');
      
      expect(data).toEqual(testData);
    });

    it('should handle request timeouts', async () => {
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 15000)) // 15 second delay
      );

      await expect(
        networkErrorHandler.fetch('https://api.example.com/test', { timeout: 1000 })
      ).rejects.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should create appropriate network errors for different scenarios', async () => {
      // Test server error
      mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
      
      try {
        await networkErrorHandler.fetch('https://api.example.com/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        const networkError = error as NetworkError;
        expect(networkError.type).toBe('server_error');
        expect(networkError.status).toBe(500);
        expect(networkError.retryable).toBe(true);
      }
    });

    it('should not retry client errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
      
      try {
        await networkErrorHandler.fetch('https://api.example.com/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        const networkError = error as NetworkError;
        expect(networkError.type).toBe('client_error');
        expect(networkError.retryable).toBe(false);
      }
      
      // Should only be called once (no retries)
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('should retry on rate limiting (429)', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
        .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
        .mockResolvedValueOnce(new Response('{"success": true}', { status: 200 }));
      
      const response = await networkErrorHandler.fetch('https://api.example.com/test');
      
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle offline scenarios', async () => {
      mockNavigator.onLine = false;
      
      try {
        await networkErrorHandler.fetch('https://api.example.com/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        const networkError = error as NetworkError;
        expect(networkError.type).toBe('offline');
        expect(networkError.retryable).toBe(true);
      }
    });
  });

  describe('Retry logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry failed requests with exponential backoff', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(new Response('{"success": true}', { status: 200 }));

      const fetchPromise = networkErrorHandler.fetch('https://api.example.com/test', {
        retryConfig: { maxRetries: 2, baseDelay: 1000, backoffFactor: 2 }
      });

      // Fast-forward through retry delays
      await vi.runAllTimersAsync();
      
      const response = await fetchPromise;
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should respect Retry-After header', async () => {
      const retryAfterResponse = new Response('Rate Limited', {
        status: 429,
        headers: { 'Retry-After': '5' }
      });
      
      mockFetch
        .mockResolvedValueOnce(retryAfterResponse)
        .mockResolvedValueOnce(new Response('{"success": true}', { status: 200 }));

      const onRetry = vi.fn();
      const fetchPromise = networkErrorHandler.fetch('https://api.example.com/test', {
        onRetry
      });

      await vi.runAllTimersAsync();
      
      const response = await fetchPromise;
      expect(response.status).toBe(200);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({ retryAfter: 5000 }),
        1,
        5000
      );
    });

    it('should stop retrying after max attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      try {
        await networkErrorHandler.fetch('https://api.example.com/test', {
          retryConfig: { maxRetries: 2 }
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Persistent network error');
      }

      await vi.runAllTimersAsync();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Online/Offline handling', () => {
    it('should detect online status', () => {
      mockNavigator.onLine = true;
      expect(networkErrorHandler.getOnlineStatus()).toBe(true);
      
      mockNavigator.onLine = false;
      expect(networkErrorHandler.getOnlineStatus()).toBe(false);
    });

    it('should queue requests when offline', () => {
      const requestFn = vi.fn().mockResolvedValue('result');
      
      networkErrorHandler.queueRequest(requestFn);
      
      // Request should not be executed immediately
      expect(requestFn).not.toHaveBeenCalled();
    });

    it('should add and remove online/offline listeners', () => {
      const onlineListener = vi.fn();
      const offlineListener = vi.fn();
      
      const removeOnline = networkErrorHandler.onOnline(onlineListener);
      const removeOffline = networkErrorHandler.onOffline(offlineListener);
      
      expect(typeof removeOnline).toBe('function');
      expect(typeof removeOffline).toBe('function');
      
      // Clean up
      removeOnline();
      removeOffline();
    });
  });

  describe('User-friendly error messages', () => {
    it('should provide appropriate messages for different error types', () => {
      const offlineError: NetworkError = Object.assign(new Error('Offline'), {
        type: 'offline' as const,
        retryable: true
      });
      
      const timeoutError: NetworkError = Object.assign(new Error('Timeout'), {
        type: 'timeout' as const,
        retryable: true
      });
      
      const serverError: NetworkError = Object.assign(new Error('Server Error'), {
        type: 'server_error' as const,
        status: 500,
        retryable: true
      });

      expect(networkErrorHandler.getUserFriendlyMessage(offlineError))
        .toContain('offline');
      expect(networkErrorHandler.getUserFriendlyMessage(timeoutError))
        .toContain('took too long');
      expect(networkErrorHandler.getUserFriendlyMessage(serverError))
        .toContain('server is experiencing issues');
    });

    it('should provide specific messages for HTTP status codes', () => {
      const notFoundError: NetworkError = Object.assign(new Error('Not Found'), {
        type: 'client_error' as const,
        status: 404,
        retryable: false
      });
      
      const unauthorizedError: NetworkError = Object.assign(new Error('Unauthorized'), {
        type: 'client_error' as const,
        status: 401,
        retryable: false
      });

      expect(networkErrorHandler.getUserFriendlyMessage(notFoundError))
        .toContain('not found');
      expect(networkErrorHandler.getUserFriendlyMessage(unauthorizedError))
        .toContain('not authorized');
    });
  });

  describe('Request cancellation', () => {
    it('should handle aborted requests', async () => {
      const controller = new AbortController();
      
      mockFetch.mockImplementation(() => {
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      try {
        await networkErrorHandler.fetch('https://api.example.com/test', {
          signal: controller.signal
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        const networkError = error as NetworkError;
        expect(networkError.type).toBe('abort');
        expect(networkError.retryable).toBe(false);
      }
    });
  });

  describe('JSON parsing errors', () => {
    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Invalid JSON{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));

      try {
        await networkErrorHandler.fetchJSON('https://api.example.com/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        const networkError = error as NetworkError;
        expect(networkError.message).toContain('Failed to parse JSON');
        expect(networkError.retryable).toBe(false);
      }
    });
  });
});