/**
 * services/clipProcessor.service.js
 * Orchestrator yang menggabungkan ytdlpService + ffmpegService + jobService
 * menjadi satu pipeline utuh: download (jika perlu) -> clip -> selesai.
 * Inilah "otak" yang dijalankan oleh queue worker untuk setiap job.
 */

const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const jobService = require('./job.service');
const ytdlpService = require('./ytdlp.service');
const ffmpegService = require('./ffmpeg.service');
const { JOB_STATUS, RESOLUTIONS } = require('../config/constants');
const { buildOutputFilename } = require('../utils/filenameSanitizer');
const { fileExists } = require('../utils/fileHelper');

/**
 * Menjalankan seluruh pipeline untuk satu job clip.
 * Semua error ditangkap di sini dan disimpan ke job.error agar SSE bisa melaporkannya
 * ke client tanpa membuat proses worker/queue crash.
 *
 * @param {string} jobId
 */
async function processClipJob(jobId) {
  const job = jobService.getJob(jobId);
  if (!job) {
    logger.warn('processClipJob dipanggil untuk job yang tidak ada', { jobId });
    return;
  }

  const { url, videoId, title, startSeconds, endSeconds, resolution } = job;
  const durationSeconds = endSeconds - startSeconds;

  try {
    // ===== TAHAP 1: DOWNLOAD (skip jika source sudah ada di downloads/) =====
    const sourcePath = path.join(config.folders.downloads, `${videoId}_${resolution}.mp4`);
    let finalSourcePath = sourcePath;

    if (fileExists(sourcePath)) {
      logger.info('Source video sudah ada di cache, skip download', { jobId, videoId });
      jobService.updateJob(jobId, {
        status: JOB_STATUS.DOWNLOADING,
        stage: 'Menggunakan video sumber dari cache...',
        progress: 50,
      });
    } else {
      jobService.updateJob(jobId, {
        status: JOB_STATUS.DOWNLOADING,
        stage: 'Mengunduh video dari YouTube...',
        progress: 0,
      });

      finalSourcePath = await ytdlpService.downloadVideo(url, videoId, resolution, (percent) => {
        // Download dianggap porsi 0-50% dari keseluruhan progress job
        jobService.updateJob(jobId, {
          progress: Math.round(percent * 0.5),
          stage: `Downloading... ${Math.round(percent)}%`,
        });
      });
    }

    // ===== TAHAP 2: CLIPPING =====
    jobService.updateJob(jobId, {
      status: JOB_STATUS.CLIPPING,
      stage: 'Memotong video sesuai rentang waktu...',
      progress: 55,
    });

    const outputFilename = buildOutputFilename(title, startSeconds);
    const outputPath = path.join(config.folders.output, `${jobId}_${outputFilename}`);

    await ffmpegService.clipVideo({
      inputPath: finalSourcePath,
      outputPath,
      startSeconds,
      durationSeconds,
      resolution,
      onProgress: (percent) => {
        // Clipping/encoding porsi 55-100%
        const overall = 55 + Math.round(percent * 0.45);
        jobService.updateJob(jobId, {
          status: JOB_STATUS.ENCODING,
          progress: Math.min(99, overall),
          stage: `Encoding... ${Math.round(percent)}%`,
        });
      },
    });

    // ===== SELESAI =====
    jobService.updateJob(jobId, {
      status: JOB_STATUS.DONE,
      progress: 100,
      stage: 'Finished.',
      outputFile: outputFilename,
      outputPath,
    });

    logger.info('Job clip selesai', { jobId, outputFilename, durationSeconds });
  } catch (err) {
    logger.error('Job clip gagal', { jobId, error: err.message });
    jobService.updateJob(jobId, {
      status: JOB_STATUS.ERROR,
      stage: 'Terjadi kesalahan.',
      error: {
        message: err.message,
        code: err.errorCode || 'INTERNAL_ERROR',
      },
    });
  }
}

module.exports = { processClipJob };
