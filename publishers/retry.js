/**
 * publishers/retry.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Retry utility with exponential backoff.
 *
 * Exported:
 *   withRetry(fn, options) → Promise
 */

'use strict';

/**
 * Executes a function with retry logic and exponential backoff.
 *
 * @param {Function} fn - Async function to execute
 * @param {object} [options={}] - Retry configuration
 * @param {number} [options.attempts=3] - Number of attempts
 * @param {number} [options.delayMs=2000] - Initial delay in milliseconds
 * @param {string} [options.backoff='exponential'] - Backoff strategy ('exponential' or 'linear')
 * @param {Function} [options.onRetry] - Callback on retry (receives attempt #, error, nextDelay)
 * @returns {Promise} Result of fn if successful, throws error after all attempts exhausted
 *
 * @example
 * const result = await withRetry(
 *   () => riskyOperation(),
 *   {
 *     attempts: 3,
 *     delayMs: 2000,
 *     backoff: 'exponential',
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retrying (attempt ${attempt}) in ${delay}ms...`);
 *     }
 *   }
 * );
 */
async function withRetry(fn, options = {}) {
  const {
    attempts = 3,
    delayMs = 2000,
    backoff = 'exponential',
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === attempts) {
        // Final attempt failed, throw the error
        break;
      }

      // Calculate delay for next attempt
      let nextDelay = delayMs;
      if (backoff === 'exponential') {
        nextDelay = delayMs * Math.pow(2, attempt - 1);
      } else if (backoff === 'linear') {
        nextDelay = delayMs * attempt;
      }

      // Invoke callback if provided
      if (typeof onRetry === 'function') {
        onRetry(attempt, err, nextDelay);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, nextDelay));
    }
  }

  // All retries exhausted
  throw lastError;
}

module.exports = { withRetry };
