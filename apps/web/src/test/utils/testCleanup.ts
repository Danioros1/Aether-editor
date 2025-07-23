import { vi } from 'vitest';

interface CleanupTask {
  name: string;
  cleanup: () => void | Promise<void>;
}

class TestCleanupManager {
  private cleanupTasks: CleanupTask[] = [];
  private timers: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();
  private eventListeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }> = [];

  /**
   * Register a cleanup task
   */
  addCleanupTask(name: string, cleanup: () => void | Promise<void>): void {
    this.cleanupTasks.push({ name, cleanup });
  }

  /**
   * Create a timeout that will be automatically cleared
   */
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    
    this.timers.add(timer);
    return timer;
  }

  /**
   * Create an interval that will be automatically cleared
   */
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const interval = setInterval(callback, delay);
    this.intervals.add(interval);
    return interval;
  }

  /**
   * Add event listener that will be automatically removed
   */
  addEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * Clear a specific timer
   */
  clearTimeout(timer: NodeJS.Timeout): void {
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  /**
   * Clear a specific interval
   */
  clearInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  /**
   * Remove a specific event listener
   */
  removeEventListener(element: EventTarget, event: string, handler: EventListener): void {
    element.removeEventListener(event, handler);
    this.eventListeners = this.eventListeners.filter(
      listener => !(listener.element === element && listener.event === event && listener.handler === handler)
    );
  }

  /**
   * Clean up all registered resources
   */
  async cleanup(): Promise<void> {
    const errors: Error[] = [];

    // Clear all timers
    for (const timer of this.timers) {
      try {
        clearTimeout(timer);
      } catch (error) {
        errors.push(error as Error);
      }
    }
    this.timers.clear();

    // Clear all intervals
    for (const interval of this.intervals) {
      try {
        clearInterval(interval);
      } catch (error) {
        errors.push(error as Error);
      }
    }
    this.intervals.clear();

    // Remove all event listeners
    for (const { element, event, handler } of this.eventListeners) {
      try {
        element.removeEventListener(event, handler);
      } catch (error) {
        errors.push(error as Error);
      }
    }
    this.eventListeners = [];

    // Run custom cleanup tasks
    for (const { name, cleanup } of this.cleanupTasks) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(new Error(`Cleanup task "${name}" failed: ${(error as Error).message}`));
      }
    }
    this.cleanupTasks = [];

    // Clear all mocks
    vi.clearAllMocks();

    // Report any errors
    if (errors.length > 0) {
      console.warn('Cleanup completed with errors:', errors);
    }
  }

  /**
   * Reset the cleanup manager
   */
  reset(): void {
    this.cleanupTasks = [];
    this.timers.clear();
    this.intervals.clear();
    this.eventListeners = [];
  }
}

// Global cleanup manager instance
export const testCleanup = new TestCleanupManager();

/**
 * Setup cleanup for a test suite
 */
export const setupTestCleanup = () => {
  return {
    beforeEach: () => {
      testCleanup.reset();
    },
    afterEach: async () => {
      await testCleanup.cleanup();
    }
  };
};

/**
 * Create a scoped cleanup manager for individual tests
 */
export const createScopedCleanup = () => {
  const scopedCleanup = new TestCleanupManager();
  
  return {
    cleanup: scopedCleanup,
    teardown: () => scopedCleanup.cleanup()
  };
};

/**
 * Mock cleanup utilities
 */
export const mockCleanup = {
  /**
   * Create a mock function that will be automatically cleared
   */
  fn: <T extends (...args: any[]) => any>(implementation?: T) => {
    const mock = vi.fn(implementation);
    testCleanup.addCleanupTask(`Mock function cleanup`, () => {
      mock.mockClear();
    });
    return mock;
  },

  /**
   * Mock a module that will be automatically restored
   */
  module: (modulePathParam: string, factory: () => any) => {
    vi.mock(modulePathParam, factory);
    testCleanup.addCleanupTask(`Module mock cleanup: ${modulePathParam}`, () => {
      vi.unmock(modulePathParam);
    });
  },

  /**
   * Spy on an object method that will be automatically restored
   */
  spyOn: <T, K extends keyof T>(object: T, method: K) => {
    const spy = vi.spyOn(object, method);
    testCleanup.addCleanupTask(`Spy cleanup: ${String(method)}`, () => {
      spy.mockRestore();
    });
    return spy;
  }
};

/**
 * DOM cleanup utilities
 */
export const domCleanup = {
  /**
   * Create an element that will be automatically removed
   */
  createElement: <K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    parent: Element = document.body
  ): HTMLElementTagNameMap[K] => {
    const element = document.createElement(tagName);
    parent.appendChild(element);
    
    testCleanup.addCleanupTask(`Remove element: ${tagName}`, () => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    return element;
  },

  /**
   * Add a class that will be automatically removed
   */
  addClass: (element: Element, className: string) => {
    element.classList.add(className);
    testCleanup.addCleanupTask(`Remove class: ${className}`, () => {
      element.classList.remove(className);
    });
  },

  /**
   * Set an attribute that will be automatically removed
   */
  setAttribute: (element: Element, name: string, value: string) => {
    const originalValue = element.getAttribute(name);
    element.setAttribute(name, value);
    
    testCleanup.addCleanupTask(`Restore attribute: ${name}`, () => {
      if (originalValue === null) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, originalValue);
      }
    });
  }
};

/**
 * Storage cleanup utilities
 */
export const storageCleanup = {
  /**
   * Set localStorage item that will be automatically cleared
   */
  setLocalStorage: (key: string, value: string) => {
    const originalValue = localStorage.getItem(key);
    localStorage.setItem(key, value);
    
    testCleanup.addCleanupTask(`Restore localStorage: ${key}`, () => {
      if (originalValue === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, originalValue);
      }
    });
  },

  /**
   * Set sessionStorage item that will be automatically cleared
   */
  setSessionStorage: (key: string, value: string) => {
    const originalValue = sessionStorage.getItem(key);
    sessionStorage.setItem(key, value);
    
    testCleanup.addCleanupTask(`Restore sessionStorage: ${key}`, () => {
      if (originalValue === null) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, originalValue);
      }
    });
  }
};