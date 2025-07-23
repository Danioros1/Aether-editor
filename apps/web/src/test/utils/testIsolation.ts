import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { testCleanup } from './testCleanup';

/**
 * Test isolation utilities to ensure tests don't interfere with each other
 */

/**
 * Reset all global state between tests
 */
export const resetGlobalState = () => {
  // Clear all timers
  vi.clearAllTimers();
  
  // Clear DOM
  cleanup();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Reset document properties
  document.title = '';
  
  // Clear storage
  localStorage.clear();
  sessionStorage.clear();
  
  // Reset URL
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', '/');
  }
  
  // Clear console
  console.clear();
};

/**
 * Isolate CSS styles between tests
 */
export const isolateStyles = () => {
  // Remove all style elements
  const styleElements = document.querySelectorAll('style');
  styleElements.forEach(el => el.remove());
  
  // Remove all link elements with stylesheets
  const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
  linkElements.forEach(el => el.remove());
  
  // Reset body styles
  document.body.style.cssText = '';
  document.documentElement.style.cssText = '';
};

/**
 * Isolate event listeners between tests
 */
export const isolateEventListeners = () => {
  // Clone and replace elements to remove all event listeners
  const elementsWithListeners = [document, window, document.body];
  
  elementsWithListeners.forEach(element => {
    if (element && typeof element.cloneNode === 'function') {
      const clone = element.cloneNode(true);
      if (element.parentNode) {
        element.parentNode.replaceChild(clone, element);
      }
    }
  });
};

/**
 * Isolate global variables between tests
 */
export const isolateGlobals = () => {
  // List of globals that should be preserved
  const preservedGlobals = new Set([
    'window', 'document', 'navigator', 'location', 'history',
    'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame',
    'fetch', 'XMLHttpRequest', 'WebSocket',
    'localStorage', 'sessionStorage',
    'performance', 'crypto',
    'URL', 'URLSearchParams',
    'Blob', 'File', 'FileReader',
    'Image', 'Audio', 'Video',
    'Worker', 'SharedWorker', 'ServiceWorker',
    'ResizeObserver', 'IntersectionObserver', 'MutationObserver',
    'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean',
    'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'JSON', 'Math', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
    'eval', 'Function'
  ]);
  
  // Remove custom globals that might have been added during tests
  Object.keys(window).forEach(key => {
    if (!preservedGlobals.has(key) && key.startsWith('test') || key.startsWith('mock')) {
      delete (window as any)[key];
    }
  });
};

/**
 * Create an isolated test environment
 */
export const createIsolatedEnvironment = () => {
  const originalState = {
    title: document.title,
    bodyHTML: document.body.innerHTML,
    headHTML: document.head.innerHTML,
    url: window.location.href,
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage }
  };
  
  return {
    restore: () => {
      // Restore document state
      document.title = originalState.title;
      document.body.innerHTML = originalState.bodyHTML;
      document.head.innerHTML = originalState.headHTML;
      
      // Restore URL
      window.history.replaceState({}, '', originalState.url);
      
      // Restore storage
      localStorage.clear();
      Object.entries(originalState.localStorage).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      sessionStorage.clear();
      Object.entries(originalState.sessionStorage).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });
    }
  };
};

/**
 * Setup complete test isolation
 */
export const setupTestIsolation = () => {
  let environment: ReturnType<typeof createIsolatedEnvironment>;
  
  return {
    beforeEach: () => {
      environment = createIsolatedEnvironment();
      resetGlobalState();
      isolateStyles();
      testCleanup.reset();
    },
    
    afterEach: async () => {
      await testCleanup.cleanup();
      environment.restore();
      resetGlobalState();
    }
  };
};

/**
 * Mock console methods to prevent test output pollution
 */
export const mockConsole = (methods: Array<keyof Console> = ['log', 'warn', 'error', 'info']) => {
  const originalMethods: Partial<Console> = {};
  
  methods.forEach(method => {
    originalMethods[method] = console[method];
    console[method] = vi.fn();
  });
  
  testCleanup.addCleanupTask('Console mock cleanup', () => {
    methods.forEach(method => {
      if (originalMethods[method]) {
        console[method] = originalMethods[method]!;
      }
    });
  });
  
  return {
    getLogs: () => methods.map(method => ({
      method,
      calls: (console[method] as any).mock.calls
    })),
    
    getLogCount: (method: keyof Console) => 
      (console[method] as any).mock?.calls?.length || 0
  };
};

/**
 * Create a sandboxed test function
 */
export const sandboxTest = (testFn: () => void | Promise<void>) => {
  return async () => {
    const environment = createIsolatedEnvironment();
    const cleanup = testCleanup;
    
    try {
      resetGlobalState();
      isolateStyles();
      cleanup.reset();
      
      await testFn();
    } finally {
      await cleanup.cleanup();
      environment.restore();
      resetGlobalState();
    }
  };
};

/**
 * Detect test interference
 */
export const detectTestInterference = () => {
  const initialState = {
    domNodes: document.querySelectorAll('*').length,
    globalKeys: Object.keys(window).length,
    storageKeys: localStorage.length + sessionStorage.length,
    timers: vi.getTimerCount?.() || 0
  };
  
  return {
    check: () => {
      const currentState = {
        domNodes: document.querySelectorAll('*').length,
        globalKeys: Object.keys(window).length,
        storageKeys: localStorage.length + sessionStorage.length,
        timers: vi.getTimerCount?.() || 0
      };
      
      const issues: string[] = [];
      
      if (currentState.domNodes > initialState.domNodes) {
        issues.push(`DOM nodes leaked: ${currentState.domNodes - initialState.domNodes}`);
      }
      
      if (currentState.globalKeys > initialState.globalKeys) {
        issues.push(`Global variables leaked: ${currentState.globalKeys - initialState.globalKeys}`);
      }
      
      if (currentState.storageKeys > initialState.storageKeys) {
        issues.push(`Storage items leaked: ${currentState.storageKeys - initialState.storageKeys}`);
      }
      
      if (currentState.timers > initialState.timers) {
        issues.push(`Timers leaked: ${currentState.timers - initialState.timers}`);
      }
      
      return {
        hasIssues: issues.length > 0,
        issues
      };
    }
  };
};