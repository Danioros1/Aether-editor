/**
 * Network Error Handler Hook
 * 
 * React hook for handling network requests with retry logic,
 * offline detection, and user-friendly error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  networkErrorHandler,
  NetworkError,
  NetworkRequestOptions,
  fetchWithRetry,
  fetchJSONWithRetry,
  isOnline,
  onNetworkOnline,
  onNetworkOffline,
  queueNetworkRequest,
  getNetworkErrorMessage
} from '@/utils/networkErrorHandler';

export interface UseNetworkErrorHandlerOptions {
  showToastOnError?: boolean;
  showToastOnOffline?: boolean;
  showToastOnOnline?: boolean;
  queueRequestsWhenOffline?: boolean;
}

export interface NetworkRequestState<T = any> {
  data: T | null;
  loading: boolean;
  error: NetworkError | null;
  retryCount: number;
}

export function useNetworkErrorHandler(options: UseNetworkErrorHandlerOptions = {}) {
  const {
    showToastOnError = true,
    showToastOnOffline = true,
    showToastOnOnline = true,
    queueRequestsWhenOffline = true
  } = options;

  const { toast } = useToast();
  const [isOnlineState, setIsOnlineState] = useState(isOnline());
  const [queuedRequestsCount, setQueuedRequestsCount] = useState(0);

  useEffect(() => {
    // Listen for online/offline events
    const removeOnlineListener = onNetworkOnline(() => {
      setIsOnlineState(true);
      if (showToastOnOnline) {
        toast({
          title: "Connection Restored",
          description: "You're back online. Queued requests will be processed.",
          variant: "default",
          duration: 3000
        });
      }
    });

    const removeOfflineListener = onNetworkOffline(() => {
      setIsOnlineState(false);
      if (showToastOnOffline) {
        toast({
          title: "Connection Lost",
          description: "You're currently offline. Requests will be queued until connection is restored.",
          variant: "destructive",
          duration: 5000
        });
      }
    });

    return () => {
      removeOnlineListener();
      removeOfflineListener();
    };
  }, [toast, showToastOnOnline, showToastOnOffline]);

  // Enhanced fetch function with error handling
  const fetchWithErrorHandling = useCallback(async (
    url: string | URL,
    options: NetworkRequestOptions = {}
  ): Promise<Response> => {
    try {
      const response = await fetchWithRetry(url, {
        ...options,
        onRetry: (error, attempt, delay) => {
          if (showToastOnError && attempt === 1) {
            toast({
              title: "Request Failed",
              description: `${getNetworkErrorMessage(error)} Retrying...`,
              variant: "default",
              duration: 3000
            });
          }
          options.onRetry?.(error, attempt, delay);
        },
        onOffline: () => {
          if (queueRequestsWhenOffline) {
            queueNetworkRequest(() => fetchWithRetry(url, options));
            setQueuedRequestsCount(prev => prev + 1);
          }
          options.onOffline?.();
        }
      });

      return response;
    } catch (error) {
      const networkError = error as NetworkError;
      
      if (showToastOnError) {
        toast({
          title: "Request Failed",
          description: getNetworkErrorMessage(networkError),
          variant: "destructive",
          duration: 5000
        });
      }

      throw networkError;
    }
  }, [toast, showToastOnError, queueRequestsWhenOffline]);

  // Enhanced fetch JSON function
  const fetchJSONWithErrorHandling = useCallback(async <T = any>(
    url: string | URL,
    options: NetworkRequestOptions = {}
  ): Promise<T> => {
    try {
      const data = await fetchJSONWithRetry<T>(url, {
        ...options,
        onRetry: (error, attempt, delay) => {
          if (showToastOnError && attempt === 1) {
            toast({
              title: "Request Failed",
              description: `${getNetworkErrorMessage(error)} Retrying...`,
              variant: "default",
              duration: 3000
            });
          }
          options.onRetry?.(error, attempt, delay);
        },
        onOffline: () => {
          if (queueRequestsWhenOffline) {
            queueNetworkRequest(() => fetchJSONWithRetry<T>(url, options));
            setQueuedRequestsCount(prev => prev + 1);
          }
          options.onOffline?.();
        }
      });

      return data;
    } catch (error) {
      const networkError = error as NetworkError;
      
      if (showToastOnError) {
        toast({
          title: "Request Failed",
          description: getNetworkErrorMessage(networkError),
          variant: "destructive",
          duration: 5000
        });
      }

      throw networkError;
    }
  }, [toast, showToastOnError, queueRequestsWhenOffline]);

  return {
    isOnline: isOnlineState,
    queuedRequestsCount,
    fetch: fetchWithErrorHandling,
    fetchJSON: fetchJSONWithErrorHandling,
    queueRequest: queueNetworkRequest,
    getErrorMessage: getNetworkErrorMessage
  };
}

/**
 * Hook for managing network request state with automatic error handling
 */
export function useNetworkRequest<T = any>(
  url: string | URL | null,
  options: NetworkRequestOptions & {
    immediate?: boolean;
    dependencies?: any[];
  } = {}
) {
  const { immediate = true, dependencies = [], ...requestOptions } = options;
  const { fetchJSON } = useNetworkErrorHandler();
  
  const [state, setState] = useState<NetworkRequestState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (retryAttempt = 0) => {
    if (!url) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      retryCount: retryAttempt
    }));

    try {
      const data = await fetchJSON<T>(url, {
        ...requestOptions,
        signal: abortControllerRef.current.signal,
        onRetry: (error, attempt, delay) => {
          setState(prev => ({ ...prev, retryCount: attempt }));
          requestOptions.onRetry?.(error, attempt, delay);
        }
      });

      setState({
        data,
        loading: false,
        error: null,
        retryCount: retryAttempt
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled, don't update state
      }

      setState({
        data: null,
        loading: false,
        error: error as NetworkError,
        retryCount: retryAttempt
      });
    }
  }, [url, fetchJSON, requestOptions]);

  const retry = useCallback(() => {
    execute(state.retryCount + 1);
  }, [execute, state.retryCount]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      data: null,
      loading: false,
      error: null,
      retryCount: 0
    });
  }, []);

  // Execute request on mount or when dependencies change
  useEffect(() => {
    if (immediate && url) {
      execute();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [immediate, url, ...dependencies]);

  return {
    ...state,
    execute,
    retry,
    reset,
    isRetryable: state.error?.retryable ?? false
  };
}

/**
 * Hook for handling multiple concurrent requests with error handling
 */
export function useNetworkBatch() {
  const { fetchJSON } = useNetworkErrorHandler();
  const [requests, setRequests] = useState<Map<string, NetworkRequestState>>(new Map());

  const executeRequest = useCallback(async <T = any>(
    key: string,
    url: string | URL,
    options: NetworkRequestOptions = {}
  ): Promise<T | null> => {
    setRequests(prev => new Map(prev.set(key, {
      data: null,
      loading: true,
      error: null,
      retryCount: 0
    })));

    try {
      const data = await fetchJSON<T>(url, {
        ...options,
        onRetry: (error, attempt, delay) => {
          setRequests(prev => {
            const current = prev.get(key);
            if (current) {
              return new Map(prev.set(key, { ...current, retryCount: attempt }));
            }
            return prev;
          });
          options.onRetry?.(error, attempt, delay);
        }
      });

      setRequests(prev => new Map(prev.set(key, {
        data,
        loading: false,
        error: null,
        retryCount: 0
      })));

      return data;
    } catch (error) {
      setRequests(prev => new Map(prev.set(key, {
        data: null,
        loading: false,
        error: error as NetworkError,
        retryCount: 0
      })));

      return null;
    }
  }, [fetchJSON]);

  const getRequest = useCallback((key: string) => {
    return requests.get(key) || {
      data: null,
      loading: false,
      error: null,
      retryCount: 0
    };
  }, [requests]);

  const clearRequest = useCallback((key: string) => {
    setRequests(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  }, []);

  const clearAllRequests = useCallback(() => {
    setRequests(new Map());
  }, []);

  return {
    executeRequest,
    getRequest,
    clearRequest,
    clearAllRequests,
    hasActiveRequests: Array.from(requests.values()).some(req => req.loading),
    hasErrors: Array.from(requests.values()).some(req => req.error)
  };
}