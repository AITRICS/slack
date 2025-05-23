/**
 * Simple logger utility
 */
class Logger {
  static info(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  }

  static error(message, error = null) {
    console.error(`[ERROR] ${message}`, error || '');
  }

  static debug(message, ...args) {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
}

module.exports = Logger;
