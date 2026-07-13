/**
 * services/ytdlp.service.js
 * Semua interaksi dengan binary yt-dlp (via child_process.spawn) terisolasi di sini.
 * Controller/route TIDAK boleh memanggil spawn() langsung.
 */

const { spawn } = require('child_process');
const path = require('path');
const config = require('../config');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { ERROR_CODES, RESOLUTION_FORMAT_MAP, RESOLUTIONS } = require('../config/constants');

const YTDLP_BIN = config.binaries.ytdlp;
const SPAWN_TIMEOUT_MS = 5 * 60 * 1000; // 5 menit guard untuk proses download

/**
 * Menerjemahkan pesan error mentah dari stderr yt-dlp menjadi AppError yang jelas.
 * @param {string} stderr
 * @returns {AppError}
 */
function mapYtdlpError(stderr) {
  const text = (stderr || '').toLowerCase();

  if (text.includes('private video')) {
    return new AppError('Video ini bersifat privat dan tidak bisa diakses.', 422, ERROR_CODES.VIDEO_PRIVATE);
  }
  if (text.includes('video unavailable') || text.includes('this video is not available')) {
    return new AppError('Video tidak ditemukan atau sudah dihapus.', 404, ERROR_CODES.VIDEO_UNAVAILABLE);
  }
  if (text.includes('sign in to confirm your age') || text.includes('age-restricted')) {
    return new AppError('Video memiliki batasan umur (age-restricted) dan tidak dapat diproses.', 422, ERROR_CODES.VIDEO_AGE_RESTRICTED);
  }
  if (text.includes('copyright')) {
    return new AppError('Video diblokir karena masalah hak cipta di wilayah Anda.', 422, ERROR_CODES.COPYRIGHT_BLOCKED);
  }
  if (text.includes('unable to download') || text.includes('http error')) {
    return new AppError('Gagal mengunduh video dari YouTube. Coba lagi nanti.', 502, ERROR_CODES.YTDLP_FAILED);
  }

  return new AppError('Gagal memproses video melalui yt-dlp.', 502, ERROR_CODES.YTDLP_FAILED, { stderr });
}

/**
 * Menjalankan yt-dlp sebagai child process dengan timeout guard.
 * @param {string[]} args
 * @param {(chunk: string) => void} [onStdout] - Callback tiap baris stdout (untuk progress)
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function runYtdlp(args, onStdout) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, { windowsHide: true });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new AppError('Proses yt-dlp melebihi batas waktu (timeout).', 504, ERROR_CODES.TIMEOUT));
    }, SPAWN_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (onStdout) {
        text.split('\n').filter(Boolean).forEach(onStdout);
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new AppError(`yt-dlp tidak ditemukan atau gagal dijalankan: ${err.message}`, 500, ERROR_CODES.YTDLP_FAILED));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(mapYtdlpError(stderr));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Mengambil metadata video (judul, thumbnail, durasi, dll) tanpa mendownload.
 * @param {string} url
 * @returns {Promise<object>} metadata terformat
 */
async function getVideoInfo(url) {
  const args = ['-j', '--no-warnings', '--no-playlist', '--skip-download', url];

  const { stdout } = await runYtdlp(args);

  let raw;
  try {
    raw = JSON.parse(stdout);
  } catch (err) {
    throw new AppError('Gagal membaca metadata video (format tidak dikenali).', 502, ERROR_CODES.YTDLP_FAILED);
  }

  const availableResolutions = extractAvailableResolutions(raw.formats || []);

  return {
    id: raw.id,
    title: raw.title,
    thumbnail: raw.thumbnail,
    duration: raw.duration, // detik
    durationLabel: formatDuration(raw.duration),
    channel: raw.channel || raw.uploader,
    uploadDate: raw.upload_date,
    viewCount: raw.view_count,
    availableResolutions,
    estimatedSizeBytes: raw.filesize || raw.filesize_approx || null,
    hasSubtitles: Boolean(raw.subtitles && Object.keys(raw.subtitles).length > 0) ||
      Boolean(raw.automatic_captions && Object.keys(raw.automatic_captions).length > 0),
    subtitleLanguages: raw.subtitles ? Object.keys(raw.subtitles) : [],
  };
}

/**
 * Ekstrak daftar resolusi unik yang tersedia dari daftar format yt-dlp.
 * @param {object[]} formats
 * @returns {string[]}
 */
function extractAvailableResolutions(formats) {
  const heights = formats
    .map((f) => f.height)
    .filter((h) => typeof h === 'number');

  const unique = [...new Set(heights)].sort((a, b) => b - a);
  return unique.map((h) => `${h}p`);
}

/**
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * Download video sumber (full, belum dipotong) ke folder downloads/.
 * Melewati proses ini jika file sudah ada (reuse cache).
 * @param {string} url
 * @param {string} videoId
 * @param {string} resolution - salah satu dari RESOLUTIONS
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<string>} path file hasil download
 */
async function downloadVideo(url, videoId, resolution, onProgress) {
  const formatSelector = RESOLUTION_FORMAT_MAP[resolution] || RESOLUTION_FORMAT_MAP[RESOLUTIONS.ORIGINAL];
  const outputTemplate = path.join(config.folders.downloads, `${videoId}_${resolution}.%(ext)s`);

  const args = [
    '-f', formatSelector,
    '--merge-output-format', 'mp4',
    '-o', outputTemplate,
    '--no-warnings',
    '--no-playlist',
    '--newline',
    url,
  ];

  const progressRegex = /\[download\]\s+(\d{1,3}\.\d)%/;

  await runYtdlp(args, (line) => {
    const match = line.match(progressRegex);
    if (match && onProgress) {
      onProgress(parseFloat(match[1]));
    }
  });

  return path.join(config.folders.downloads, `${videoId}_${resolution}.mp4`);
}

module.exports = { getVideoInfo, downloadVideo, mapYtdlpError };
