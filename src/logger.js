const fs = require('fs');
const path = require('path');

const MAX_LOG_BYTES = 1024 * 1024;

/** Appends to <userData>/logs/clipbo.log; keeps one rotated copy (clipbo.old.log). */
function createLogger(dataDirectory) {
  const directory = path.join(dataDirectory, 'logs');
  const file = path.join(directory, 'clipbo.log');
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  } catch {
    // Logging must never stop the app from starting.
  }

  return function log(level, message, error) {
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_LOG_BYTES) {
        fs.renameSync(file, path.join(directory, 'clipbo.old.log'));
      }
      const detail = error ? ` ${error.stack || error}` : '';
      fs.appendFileSync(file, `${new Date().toISOString()} [${level}] ${message}${detail}\n`, { mode: 0o600 });
    } catch {
      // Logging must never crash the app.
    }
  };
}

module.exports = { createLogger };
