/**
 * utils/logger.js
 * Logger ringan tanpa dependency besar (winston-style tapi custom).
 * Menulis log terstruktur (JSON per baris) ke logs/activity.log dan logs/error.log,
 * sekaligus mencetak ke console dengan warna sederhana untuk development.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.logging.level] ?? LEVELS.info;

// Pastikan folder logs ada
if (!fs.existsSync(config.folders.logs)) {
  fs.mkdirSync(config.folders.logs, { recursive: true });
}

const ACTIVITY_LOG = path.join(config.folders.logs, 'activity.log');
const ERROR_LOG = path.join(config.folders.logs, 'error.log');

const COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
};

/**
 * Menulis satu baris JSON ke file log (append, async agar tidak blocking).
 * @param {string} filePath
 * @param {object} entry
 */
function writeToFile(filePath, entry) {
  fs.appendFile(filePath, JSON.stringify(entry) + '\n', (err) => {
    if (err) {
      // Fallback terakhir: tampilkan di console agar tidak hilang senyap
      console.error('Gagal menulis log ke file:', err.message);
    }
  });
}

/**
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} message
 * @param {object} [meta] - Data tambahan (mis. { jobId, url, duration })
 */
function log(level, message, meta = {}) {
  if (LEVELS[level] > currentLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const color = COLORS[level] || COLORS.reset;
  console.log(`${color}[${entry.timestamp}] [${level.toUpperCase()}]${COLORS.reset} ${message}`, Object.keys(meta).length ? meta : '');

  writeToFile(ACTIVITY_LOG, entry);
  if (level === 'error') writeToFile(ERROR_LOG, entry);
}

module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};
