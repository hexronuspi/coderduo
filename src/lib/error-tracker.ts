/**
 * Simple error tracking utility to help debug and resolve payment issues
 * Logs errors to both console and localStorage for retrieval
 */

// Maximum number of errors to track
const MAX_ERRORS = 20;

// Error storage key
const ERROR_STORAGE_KEY = 'cosly_payment_errors';

/**
 * Track a new error with context
 */
export function trackError(source: string, error: unknown, context?: Record<string, unknown>): void {
  try {
    // Create error entry with timestamp and details
    const errorEntry = {
      timestamp: new Date().toISOString(),
      source,
      message: (error instanceof Error) ? error.message : String(error),
      stack: (error instanceof Error) ? error.stack : undefined,
      code: (error instanceof Error && 'code' in error) ? (error as {code?: string}).code : undefined,
      context: context || {}
    };
    
    // Log to console
    console.error(`[${source}] Error:`, errorEntry);
    
    // Store in localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      // Get existing errors
      const existingErrorsString = localStorage.getItem(ERROR_STORAGE_KEY);
      let errors = [];
      
      if (existingErrorsString) {
        try {
          errors = JSON.parse(existingErrorsString);
        } catch (_error) {
          console.log(_error)
          // Reset if corrupted
          errors = [];
        }
      }
      
      // Add new error and limit size
      errors.unshift(errorEntry);
      if (errors.length > MAX_ERRORS) {
        errors = errors.slice(0, MAX_ERRORS);
      }
      
      // Save back to storage
      localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(errors));
    }
  } catch (e) {
    // Fallback if tracking itself fails
    console.error('Error in error tracking:', e);
  }
}

/**
 * Get all tracked errors
 */
interface TrackedError {
    timestamp: string;
    source: string;
    message: string;
    stack?: string;
    code?: string;
    context: Record<string, unknown>;
}

export function getTrackedErrors(): TrackedError[] {
        if (typeof window !== 'undefined' && window.localStorage) {
                const errors = localStorage.getItem(ERROR_STORAGE_KEY);
                if (errors) {
                        try {
                                return JSON.parse(errors) as TrackedError[];
                        } catch (error) {
                                console.log(error);
                                return [];
                        }
                }
        }
        return [];
}

/**
 * Clear tracked errors
 */
export function clearTrackedErrors(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(ERROR_STORAGE_KEY);
  }
}
