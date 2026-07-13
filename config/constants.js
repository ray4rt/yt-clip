/**
 * config/constants.js
 * Konstanta yang dipakai lintas layer agar tidak ada "magic string" tersebar.
 */

const JOB_STATUS = Object.freeze({
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  CLIPPING: 'clipping',
  ENCODING: 'encoding',
  DONE: 'done',
  ERROR: 'error',
});

const ERROR_CODES = Object.freeze({
  INVALID_URL: 'INVALID_URL',
  VIDEO_PRIVATE: 'VIDEO_PRIVATE',
  VIDEO_UNAVAILABLE: 'VIDEO_UNAVAILABLE',
  VIDEO_AGE_RESTRICTED: 'VIDEO_AGE_RESTRICTED',
  COPYRIGHT_BLOCKED: 'COPYRIGHT_BLOCKED',
  YTDLP_FAILED: 'YTDLP_FAILED',
  FFMPEG_FAILED: 'FFMPEG_FAILED',
  INVALID_TIME_RANGE: 'INVALID_TIME_RANGE',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  DISK_FULL: 'DISK_FULL',
  TIMEOUT: 'TIMEOUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

const RESOLUTIONS = Object.freeze({
  ORIGINAL: 'original',
  P1080: '1080p',
  P720: '720p',
  P480: '480p',
  P360: '360p',
});

// Mapping resolusi -> format selector yt-dlp
const RESOLUTION_FORMAT_MAP = Object.freeze({
  [RESOLUTIONS.ORIGINAL]: 'bestvideo+bestaudio/best',
  [RESOLUTIONS.P1080]: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
  [RESOLUTIONS.P720]: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
  [RESOLUTIONS.P480]: 'bestvideo[height<=480]+bestaudio/best[height<=480]',
  [RESOLUTIONS.P360]: 'bestvideo[height<=360]+bestaudio/best[height<=360]',
});

const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{11}/i;

module.exports = {
  JOB_STATUS,
  ERROR_CODES,
  RESOLUTIONS,
  RESOLUTION_FORMAT_MAP,
  YOUTUBE_URL_REGEX,
};
