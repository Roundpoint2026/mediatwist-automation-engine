/**
 * publishers/logger.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Structured logging for publishing modules.
 * Logs with timestamps to console and appends to logs/engine.log
 *
 * Exported:
 *   createLogger(module) → { info, warn, error, success }
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'engine.log');

/**
 * Formats a log entry with timestamp, level, module, and message.
 * @private
 * @param {string} level - Log level (INFO, WARN, ERROR, SUCCESS)
 * @param {string} moduleName - Module identifier
 * @param {string} message - Log message
 * @returns {string} Formatted log entry
 */
function formatLog(level, moduleName, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] [${moduleName}] ${message}`;
}

/**
 * Appends a log entry to the log file.
 * @private
 * @param {string} entry - Log entry to write
 */
function appendToFile(entry) {
  try {
    fs.appendFileSync(logFile, entry + '\n', { encoding: 'utf8' });
  } catch (err) {
    console.error(`[ERROR] Failed to write to log file: ${err.message}`);
  }
}

/**
 * Creates a logger instance for a specific module.
 * @param {string} moduleName - Identifier for the module (e.g., 'publisher:facebook')
 * @returns {object} Logger with info, warn, error, success methods
 */
function createLogger(moduleName) {
  return {
    /**
     * Info level log
     * @param {string} message - Message to log
     */
    info(message) {
      const entry = formatLog('INFO', moduleName, message);
      console.log(entry);
      appendToFile(entry);
    },

    /**
     * Warning level log
     * @param {string} message - Message to log
     */
    warn(message) {
      const entry = formatLog('WARN', moduleName, message);
      console.warn(entry);
      appendToFile(entry);
    },

    /**
     * Error level log
     * @param {string} message - Message to log
     */
    error(message) {
      const entry = formatLog('ERROR', moduleName, message);
      console.error(entry);
      appendToFile(entry);
    },

    /**
     * Success level log
     * @param {string} message - Message to log
     */
    success(message) {
      const entry = formatLog('SUCCESS', moduleName, message);
      console.log(entry);
      appendToFile(entry);
    },
  };
}

module.exports = { createLogger };
