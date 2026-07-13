/**
 * services/ffmpeg.service.js
 * Semua interaksi dengan FFmpeg (via fluent-ffmpeg) terisolasi di sini.
 * Mendukung clipping inti + fitur bonus (convert mp3, extract audio, watermark, fps, compress).
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStaticPath = require('ffmpeg-static');
const path = require('path');
const config = require('../config');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/constants');

// Gunakan binary dari .env jika di-set, jika tidak fallback ke ffmpeg-static (portable, tanpa install manual)
const FFMPEG_PATH = config.binaries.ffmpeg || ffmpegStaticPath;
if (FFMPEG_PATH) ffmpeg.setFfmpegPath(FFMPEG_PATH);
if (config.binaries.ffprobe) ffmpeg.setFfprobePath(config.binaries.ffprobe);

const RESOLUTION_HEIGHT_MAP = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
};

/**
 * Bungkus command fluent-ffmpeg menjadi Promise, dengan progress callback.
 * @param {import('fluent-ffmpeg').FfmpegCommand} command
 * @param {string} outputPath
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<string>}
 */
function runCommand(command, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    command
      .on('progress', (progress) => {
        if (onProgress && typeof progress.percent === 'number') {
          onProgress(Math.min(100, Math.max(0, progress.percent)));
        }
      })
      .on('error', (err) => {
        reject(new AppError(`FFmpeg gagal memproses video: ${err.message}`, 500, ERROR_CODES.FFMPEG_FAILED));
      })
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
}

/**
 * Memotong video (clip) sesuai rentang waktu, opsional resize resolusi.
 * @param {object} params
 * @param {string} params.inputPath
 * @param {string} params.outputPath
 * @param {number} params.startSeconds
 * @param {number} params.durationSeconds
 * @param {string} [params.resolution] - '1080p' | '720p' | '480p' | '360p' | 'original'
 * @param {(percent: number) => void} [params.onProgress]
 * @returns {Promise<string>} outputPath
 */
function clipVideo({ inputPath, outputPath, startSeconds, durationSeconds, resolution, onProgress }) {
  const command = ffmpeg(inputPath)
    .setStartTime(startSeconds)
    .setDuration(durationSeconds)
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputOptions(['-preset veryfast', '-movflags +faststart']);

  const targetHeight = RESOLUTION_HEIGHT_MAP[resolution];
  if (targetHeight) {
    // Scale menjaga aspect ratio, tinggi genap (syarat codec H.264)
    command.videoFilters(`scale=-2:${targetHeight}`);
  }

  return runCommand(command, outputPath, onProgress);
}

/**
 * [BONUS] Konversi video menjadi MP3.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {(percent: number) => void} [onProgress]
 */
function convertToMp3(inputPath, outputPath, onProgress) {
  const command = ffmpeg(inputPath)
    .noVideo()
    .audioCodec('libmp3lame')
    .audioBitrate('192k');
  return runCommand(command, outputPath, onProgress);
}

/**
 * [BONUS] Ekstrak audio asli tanpa re-encode (lebih cepat, kualitas tetap).
 * @param {string} inputPath
 * @param {string} outputPath - disarankan ekstensi .m4a
 * @param {(percent: number) => void} [onProgress]
 */
function extractAudio(inputPath, outputPath, onProgress) {
  const command = ffmpeg(inputPath).noVideo().audioCodec('copy');
  return runCommand(command, outputPath, onProgress);
}

/**
 * [BONUS] Tambahkan watermark image di pojok video.
 * @param {string} inputPath
 * @param {string} watermarkImagePath
 * @param {string} outputPath
 * @param {'topleft'|'topright'|'bottomleft'|'bottomright'} [position='bottomright']
 * @param {(percent: number) => void} [onProgress]
 */
function addWatermark(inputPath, watermarkImagePath, outputPath, position = 'bottomright', onProgress) {
  const positions = {
    topleft: '10:10',
    topright: 'main_w-overlay_w-10:10',
    bottomleft: '10:main_h-overlay_h-10',
    bottomright: 'main_w-overlay_w-10:main_h-overlay_h-10',
  };
  const overlayPos = positions[position] || positions.bottomright;

  const command = ffmpeg(inputPath)
    .input(watermarkImagePath)
    .complexFilter([`overlay=${overlayPos}`])
    .videoCodec('libx264')
    .audioCodec('copy');

  return runCommand(command, outputPath, onProgress);
}

/**
 * [BONUS] Ubah frame rate video.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} fps
 * @param {(percent: number) => void} [onProgress]
 */
function changeFps(inputPath, outputPath, fps, onProgress) {
  const command = ffmpeg(inputPath).fps(fps).videoCodec('libx264').audioCodec('copy');
  return runCommand(command, outputPath, onProgress);
}

/**
 * [BONUS] Kompres video dengan menaikkan CRF (mengurangi ukuran, kualitas sedikit turun).
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} [crf=28] - Semakin tinggi = semakin kecil ukuran (18-28 rekomendasi umum)
 * @param {(percent: number) => void} [onProgress]
 */
function compressVideo(inputPath, outputPath, crf = 28, onProgress) {
  const command = ffmpeg(inputPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputOptions([`-crf ${crf}`, '-preset slower']);
  return runCommand(command, outputPath, onProgress);
}

/**
 * [BONUS] Crop video ke area tertentu.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {{ width: number, height: number, x: number, y: number }} box
 * @param {(percent: number) => void} [onProgress]
 */
function cropVideo(inputPath, outputPath, box, onProgress) {
  const command = ffmpeg(inputPath)
    .videoFilters(`crop=${box.width}:${box.height}:${box.x}:${box.y}`)
    .videoCodec('libx264')
    .audioCodec('copy');
  return runCommand(command, outputPath, onProgress);
}

/**
 * [BONUS] Burn subtitle (hardcode) ke dalam video.
 * @param {string} inputPath
 * @param {string} subtitlePath - file .srt/.vtt
 * @param {string} outputPath
 * @param {(percent: number) => void} [onProgress]
 */
function burnSubtitle(inputPath, subtitlePath, outputPath, onProgress) {
  // Escape path untuk filter ffmpeg (khususnya di Windows, colon perlu di-escape)
  const escapedPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
  const command = ffmpeg(inputPath)
    .videoFilters(`subtitles='${escapedPath}'`)
    .videoCodec('libx264')
    .audioCodec('copy');
  return runCommand(command, outputPath, onProgress);
}

/**
 * [BONUS] Menggabungkan beberapa clip menjadi satu video (concat demuxer).
 * Semua input harus punya codec/resolusi yang sama untuk hasil terbaik.
 * @param {string[]} inputPaths
 * @param {string} outputPath
 * @param {(percent: number) => void} [onProgress]
 */
function mergeClips(inputPaths, outputPath, onProgress) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    inputPaths.forEach((p) => command.input(p));

    command
      .on('progress', (progress) => {
        if (onProgress && typeof progress.percent === 'number') {
          onProgress(Math.min(100, Math.max(0, progress.percent)));
        }
      })
      .on('error', (err) => reject(new AppError(`Gagal menggabungkan clip: ${err.message}`, 500, ERROR_CODES.FFMPEG_FAILED)))
      .on('end', () => resolve(outputPath))
      .mergeToFile(outputPath, path.dirname(outputPath));
  });
}

/**
 * Ambil durasi video via ffprobe (dipakai untuk validasi sebelum clipping).
 * @param {string} filePath
 * @returns {Promise<number>} durasi dalam detik
 */
function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new AppError(`Gagal membaca metadata video: ${err.message}`, 500, ERROR_CODES.FFMPEG_FAILED));
        return;
      }
      resolve(metadata.format.duration);
    });
  });
}

module.exports = {
  clipVideo,
  convertToMp3,
  extractAudio,
  addWatermark,
  changeFps,
  compressVideo,
  cropVideo,
  burnSubtitle,
  mergeClips,
  getVideoDuration,
};
