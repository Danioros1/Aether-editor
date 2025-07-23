/**
 * Network Error Handler with Retry Mechanisms
 * 
 * Provides robust network error handling with exponential backoff,
 * offline detection, and user-friendly error messages.
 */

import { logNetworkError } from './errorLogger';

export type NetworkErrorType = 
  | 'timeout' 
  | 'offline' 
  | 'server_error' 
  | 'client_error' 
  | 'network_error' 
  | 'abort' 
  | 'unknown';

export interface NetworkError extends Error {
  type: NetworkErrorType;
  status?: number;
  statusText?: string;
  url?: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  retryCondition?: (error: NetworkError, attempt: number) => boolean;
}

export interface NetworkRequestOptions extends RequestInit {
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  onRetry?: (error: NetworkError, attempt: number, delay: number) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryCondition: (error, attempt) => {
    // Retry on network errors, timeouts, and 5xx server errors
    return error.retryable && attempt < 3;
  }
};

class NetworkErrorHandler {
  private isOnline: boolean = navigator.onLine;
  private onlineListeners: Set<() => void> = new Set();
  private offlineListeners: Set<() => void> = new Set();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    this.setupOnlineOfflineHandlers();
  }

  /**
   * Setup online/offline event handlers
   */
  private setupOnlineOfflineHandlers(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Periodic connectivity check
    setInterval(this.checkConnectivity, 30000); // Check every 30 seconds
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    this.isOnline = true;
    console.log('🌐 Network connection restored');
    
    this.onlineListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in online listener:', error);
      }
    });

    // Process queued requests
    this.processRequestQueue();
  };

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    this.isOnline = false;
    console.log('🚫 Network connection lost');
    
    this.offlineListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in offline listener:', error);
      }
    });
  };

  /**
   * Check connectivity by making a lightweight request
   */
  private checkConnectivity = async (): Promise<void> => {
    try {
      const response = await fetch('/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!this.isOnline && response.ok) {
        this.handleOnline();
      }
    } catch (error) {
      if (this.isOnline) {
        this.handleOffline();
      }
    }
  };

  /**
   * Process queued requests when coming back online
   */
  private async processRequestQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`📤 Processing ${this.requestQueue.length} queued requests`);

    const requests = [...this.requestQueue];
    this.requestQueue = [];

    for (const request of requests) {
      try {
        await request();
      } catch (error) {
        console.error('Error processing queued request:', error);
      }
    }

    this.isProcessingQueue = false;
  };

  /**
   * Create a network error from various error types
   */
  private createNetworkError(
    error: any, 
    url?: string, 
    response?: Response
  ): NetworkError {
    let networkError: NetworkError;

    if (error.name === 'AbortError') {
      networkError = Object.assign(new Error('Request was aborted'), {
        type: 'abort' as NetworkErrorType,
        retryable: false
      });
    } else if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      networkError = Object.assign(new Error('Request timed out'), {
        type: 'timeout' as NetworkErrorType,
        retryable: true
      });
    } else if (!navigator.onLine) {
      networkError = Object.assign(new Error('No internet connection'), {
        type: 'offline' as NetworkErrorType,
        retryable: true
      });
    } else if (response) {
      const isServerError = response.status >= 500;
      const isClientError = response.status >= 400 && response.status < 500;
      
      networkError = Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
        type: isServerError ? 'server_error' : isClientError ? 'client_error' : 'unknown' as NetworkErrorType,
        status: response.status,
        statusText: response.statusText,
        retryable: isServerError || response.status === 429 // Retry server errors and rate limits
      });

      // Check for Retry-After header
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) {
        networkError.retryAfter = parseInt(retryAfter) * 1000; // Convert to milliseconds
      }
    } else {
      networkError = Object.assign(new Error(error.message || 'Network error occurred'), {
        type: 'network_error' as NetworkErrorType,
        retryable: true
      });
    }

    networkError.url = url;
    return networkError;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(
    attempt: number, 
    config: RetryConfig, 
    retryAfter?: number
  ): number {
    if (retryAfter) {
      return retryAfter;
    }

    let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitter) {
      // Add random jitter (±25%)
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Math.max(delay, 0);
  };

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhanced fetch with retry logic and error handling
   */
  async fetch(
    url: string | URL, 
    options: NetworkRequestOptions = {}
  ): Promise<Response> {
    const {
      timeout = 10000,
      retryConfig: userRetryConfig = {},
      onRetry,
      onOffline,
      onOnline,
      ...fetchOptions
    } = options;

    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...userRetryConfig };
    const urlString = url.toString();

    // Check if offline
    if (!this.isOnline) {
      const offlineError = this.createNetworkError(
        new Error('No internet connection'), 
        urlString
      );
      
      if (onOffline) {
        onOffline();
      }

      logNetworkError(offlineError.message, {
        url: urlString,
        type: offlineError.type,
        offline: true
      });

      throw offlineError;
    }

    let lastError: NetworkError | undefined;
    
    for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Combine user signal with timeout signal
        const signal = fetchOptions.signal 
          ? AbortSignal.any([fetchOptions.signal, controller.signal])
          : controller.signal;

        const response = await fetch(url, {
          ...fetchOptions,
          signal
        });

        clearTimeout(timeoutId);

        // Check if response is ok
        if (!response.ok) {
          const error = this.createNetworkError(
            new Error(`HTTP ${response.status}`), 
            urlString, 
            response
          );
          
          // Don't retry client errors (except 429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            logNetworkError(error.message, {
              url: urlString,
              status: response.status,
              statusText: response.statusText,
              attempt,
              retryable: false
            });
            throw error;
          }

          lastError = error;
        } else {
          // Success
          return response;
        }
      } catch (error: any) {
        lastError = this.createNetworkError(error, urlString);
      }

      // Check if we should retry
      const shouldRetry = attempt <= retryConfig.maxRetries && 
                         lastError.retryable && 
                         retryConfig.retryCondition!(lastError, attempt);

      if (!shouldRetry) {
        break;
      }

      // Calculate delay and wait
      const delay = this.calculateRetryDelay(attempt, retryConfig, lastError?.retryAfter);
      
      console.warn(`🔄 Retrying request to ${urlString} (attempt ${attempt}/${retryConfig.maxRetries}) after ${delay}ms`);
      
      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      logNetworkError(`Request retry ${attempt}/${retryConfig.maxRetries}`, {
        url: urlString,
        error: lastError?.message || 'Unknown error',
        delay,
        attempt
      });

      await this.sleep(delay);

      // Check if we're still online before retrying
      if (!this.isOnline) {
        const offlineError = this.createNetworkError(
          new Error('Connection lost during retry'), 
          urlString
        );
        
        if (onOffline) {
          onOffline();
        }

        throw offlineError;
      }
    }

    // All retries exhausted
    if (lastError) {
      logNetworkError(`Request failed after ${retryConfig.maxRetries} retries`, {
        url: urlString,
        error: lastError.message,
        type: lastError.type,
        finalAttempt: true
      });

      throw lastError;
    } else {
      const error = this.createNetworkError(new Error('Request failed with no error details'), urlString);
      throw error;
    }
  }

  /**
   * Enhanced fetch with JSON parsing and error handling
   */
  async fetchJSON<T = any>(
    url: string | URL, 
    options: NetworkRequestOptions = {}
  ): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    try {
      return await response.json();
    } catch (error) {
      const parseError = this.createNetworkError(
        new Error('Failed to parse JSON response'), 
        url.toString()
      );
      parseError.retryable = false;
      
      logNetworkError(parseError.message, {
        url: url.toString(),
        status: response.status,
        contentType: response.headers.get('content-type')
      });

      throw parseError;
    }
  }

  /**
   * Queue request for when connection is restored
   */
  queueRequest(requestFn: () => Promise<any>): void {
    this.requestQueue.push(requestFn);
    console.log(`📥 Queued request (${this.requestQueue.length} total)`);
  }

  /**
   * Add online event listener
   */
  onOnline(listener: () => void): () => void {
    this.onlineListeners.add(listener);
    return () => this.onlineListeners.delete(listener);
  }

  /**
   * Add offline event listener
   */
  onOffline(listener: () => void): () => void {
    this.offlineListeners.add(listener);
    return () => this.offlineListeners.delete(listener);
  }

  /**
   * Get current online status
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error: NetworkError): string {
    switch (error.type) {
      case 'offline':
        return 'You appear to be offline. Please check your internet connection and try again.';
      case 'timeout':
        return 'The request took too long to complete. Please try again.';
      case 'server_error':
        return 'The server is experiencing issues. Please try again in a few moments.';
      case 'client_error':
        if (error.status === 404) {
          return 'The requested resource was not found.';
        } else if (error.status === 401) {
          return 'You are not authorized to access this resource.';
        } else if (error.status === 403) {
          return 'Access to this resource is forbidden.';
        } else if (error.status === 429) {
          return 'Too many requests. Please wait a moment before trying again.';
        }
        return 'There was a problem with your request. Please check and try again.';
      case 'abort':
        return 'The request was cancelled.';
      case 'network_error':
        return 'A network error occurred. Please check your connection and try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.onlineListeners.clear();
    this.offlineListeners.clear();
    this.requestQueue = [];
  }
}

// Create singleton instance
export const networkErrorHandler = new NetworkErrorHandler();

// Convenience functions
export const fetchWithRetry = (url: string | URL, options?: NetworkRequestOptions) => 
  networkErrorHandler.fetch(url, options);

export const fetchJSONWithRetry = <T = any>(url: string | URL, options?: NetworkRequestOptions) => 
  networkErrorHandler.fetchJSON<T>(url, options);

export const isOnline = () => networkErrorHandler.getOnlineStatus();

export const onNetworkOnline = (listener: () => void) => networkErrorHandler.onOnline(listener);

export const onNetworkOffline = (listener: () => void) => networkErrorHandler.onOffline(listener);

export const queueNetworkRequest = (requestFn: () => Promise<any>) => 
  networkErrorHandler.queueRequest(requestFn);

export const getNetworkErrorMessage = (error: NetworkError) => 
  networkErrorHandler.getUserFriendlyMessage(error);