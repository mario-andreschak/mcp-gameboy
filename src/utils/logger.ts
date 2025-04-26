import * as fs from 'fs';
import * as path from 'path';
import { string } from 'zod';

const logFilePath = './mcp-gameboy.log';
// const logFilePath = path.join(process.cwd(), 'mcp-gameboy.log');

// Ensure the log file exists
try {
  fs.appendFileSync(logFilePath, ''); // Create file if it doesn't exist, or just touch it
} catch (err) {
  console.error('CRITICAL FAILURE: Failed to ensure log file exists:', err); // Use console here as logger isn't ready
}

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'VERBOSE';

function writeLog(level: LogLevel, message: string, ...optionalParams: any[]) {
  const timestamp = new Date().toISOString();
  let logEntry = `${timestamp} [${level}] ${message}`;

  if (optionalParams.length > 0) {
    // Handle additional parameters, ensuring objects are stringified for VERBOSE
    const formattedParams = optionalParams.map(param => {
      if (level === 'VERBOSE' && typeof param === 'object' && param !== null) {
        try {
          // Use JSON.stringify for verbose objects as per requirement
          return JSON.stringify(param);
        } catch (e) {
          return '[Unserializable Object]';
        }
      } else if (typeof param === 'object' && param !== null) {
         // For other levels, use a simpler representation or toString()
         return param instanceof Error ? param.stack || param.message : JSON.stringify(param); // Show stack for errors
      } else {
        return String(param);
      }
    });
    logEntry += ` ${formattedParams.join(' ')}`;
  }

  logEntry += '\n'; // Add newline for separation

  try {
    fs.appendFileSync(logFilePath, logEntry);
  } catch (err) {
    // Fallback to console if file logging fails
    console.error(`Failed to write to log file: ${logFilePath}`, err);
  }
}

/**
 * Logger utility for MCP-GameBoy
 * Writes logs to a file instead of console output
 */
export const log = {
  /**
   * Log informational messages
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  info: (message: string, ...optionalParams: any[]) => {
    writeLog('INFO', message, ...optionalParams);
  },

  /**
   * Log error messages
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  error: (message: string, ...optionalParams: any[]) => {
    console.error(message)
    writeLog('ERROR', message, ...optionalParams);
  },

  /**
   * Log warning messages
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  warn: (message: string, ...optionalParams: any[]) => {
    writeLog('WARN', message, ...optionalParams);
  },

  /**
   * Log debug messages
   * @param message The message to log
   * @param optionalParams Additional parameters to log
   */
  debug: (message: string, ...optionalParams: any[]) => {
    writeLog('DEBUG', message, ...optionalParams);
  },

  /**
   * Log verbose messages
   * Objects passed to this method will be serialized with JSON.stringify
   * @param message The message to log
   * @param optionalParams Additional parameters to log (objects will be JSON.stringify'd)
   */
  verbose: (message: string, ...optionalParams: any[]) => {
    writeLog('VERBOSE', message, ...optionalParams);
  }
};
