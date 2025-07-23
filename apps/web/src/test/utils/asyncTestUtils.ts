import { waitFor } from '@testing-library/react';

export interface WaitForOptions {
  timeout?: number;
  interval?: number;
}

/**
 * Enhanced waitFor with better error messages and debugging
 */
export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  message: string,
  options: WaitForOptions = {}
): Promise<void> => {
  const { timeout = 5000, interval = 50 } = options;
  
  try {
    await waitFor(
      async () => {
        const result = await condition();
        if (!result) {
          throw new Error(`Condition not met: ${message}`);
        }
      },
      { timeout, interval }
    );
  } catch (error) {
    throw new Error(`waitForCondition failed: ${message}. ${error}`);
  }
};

/**
 * Wait for element to appear with better error handling
 */
export const waitForElement = async (
  getElement: () => HTMLElement | null,
  elementDescription: string,
  options: WaitForOptions = {}
): Promise<HTMLElement> => {
  let element: HTMLElement | null = null;
  
  await waitForCondition(
    () => {
      element = getElement();
      return element !== null;
    },
    `Element to appear: ${elementDescription}`,
    options
  );
  
  return element!;
};

/**
 * Wait for element to disappear
 */
export const waitForElementToDisappear = async (
  getElement: () => HTMLElement | null,
  elementDescription: string,
  options: WaitForOptions = {}
): Promise<void> => {
  await waitForCondition(
    () => getElement() === null,
    `Element to disappear: ${elementDescription}`,
    options
  );
};

/**
 * Wait for async operation with timeout
 */
export const waitForAsync = async <T>(
  asyncOperation: () => Promise<T>,
  operationDescription: string,
  timeout: number = 5000
): Promise<T> => {
  return Promise.race([
    asyncOperation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Async operation timed out: ${operationDescription}`));
      }, timeout);
    })
  ]);
};

/**
 * Retry an operation with exponential backoff
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Operation failed after ${maxRetries} attempts. Last error: ${lastError!.message}`);
};

/**
 * Wait for multiple conditions to be true
 */
export const waitForAll = async (
  conditions: Array<{
    condition: () => boolean | Promise<boolean>;
    description: string;
  }>,
  options: WaitForOptions = {}
): Promise<void> => {
  await Promise.all(
    conditions.map(({ condition, description }) =>
      waitForCondition(condition, description, options)
    )
  );
};

/**
 * Wait for any of multiple conditions to be true
 */
export const waitForAny = async (
  conditions: Array<{
    condition: () => boolean | Promise<boolean>;
    description: string;
  }>,
  options: WaitForOptions = {}
): Promise<number> => {
  return new Promise((resolve, reject) => {
    const { timeout = 5000 } = options;
    let resolved = false;
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`None of the conditions were met within ${timeout}ms`));
      }
    }, timeout);
    
    conditions.forEach(({ condition, description }, index) => {
      waitForCondition(condition, description, options)
        .then(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(index);
          }
        })
        .catch(() => {
          // Individual condition failures are handled by the timeout
        });
    });
  });
};

/**
 * Debounced wait - waits for condition to be stable for a period
 */
export const waitForStable = async (
  condition: () => boolean | Promise<boolean>,
  description: string,
  stableTime: number = 100,
  options: WaitForOptions = {}
): Promise<void> => {
  const { timeout = 5000 } = options;
  const startTime = Date.now();
  let lastChangeTime = startTime;
  let lastResult: boolean | undefined;
  
  while (Date.now() - startTime < timeout) {
    const currentResult = await condition();
    
    if (currentResult !== lastResult) {
      lastChangeTime = Date.now();
      lastResult = currentResult;
    }
    
    if (currentResult && Date.now() - lastChangeTime >= stableTime) {
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  throw new Error(`Condition never became stable: ${description}`);
};