/**
 * config/index.js
 * Memuat environment variables dan mengekspos konfigurasi terpusat.
 * Semua module lain HARUS mengambil config dari sini, bukan dari process.env langsung.
 */

const path = require('path');
require('dotenv').config();

const ROOT_DIR = path.join(__dirname, '..');

/**
 * Resolve folder path dari env (relative ke root project) menjadi absolute path.
 * @param {string} envValue
 * @param {string} fallback
 * @returns {string}
 */
function resolveFolder(envValue, fallback) {
  const value = envValue || fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
}

const config = {
  rootDir: ROOT_DIR,

  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    isProduction: process.env.NODE_ENV === 'production',
  },

  folders: {
    temp: resolveFolder(process.env.TEMP_FOLDER, 'temp'),
    output: resolveFolder(process.env.OUTPUT_FOLDER, 'output'),
    downloads: resolveFolder(process.env.DOWNLOAD_FOLDER, 'downloads'),
    logs: resolveFolder(process.env.LOG_FOLDER, 'logs'),
  },

  binaries: {
    ytdlp: process.env.YTDLP_PATH || 'yt-dlp',
    ffmpeg: process.env.FFMPEG_PATH || null, // null -> fallback ke ffmpeg-static
    ffprobe: process.env.FFPROBE_PATH || null,
  },

  job: {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS, 10) || 2,
    fileTtlMinutes: parseInt(process.env.FILE_TTL_MINUTES, 10) || 30,
    cleanupIntervalMinutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES, 10) || 5,
    maxClipDurationSeconds: parseInt(process.env.MAX_CLIP_DURATION_SECONDS, 10) || 1800,
  },

  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 3600,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 20,
    clipMax: parseInt(process.env.RATE_LIMIT_CLIP_MAX, 10) || 5,
  },

  security: {
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;
