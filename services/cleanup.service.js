/**
 * services/cleanup.service.js
 * Membersihkan file di temp/ dan output/ yang sudah melewati TTL (default 30 menit),
 * serta menghapus entry job yang sudah selesai dari memory.
 * Dijalankan berkala via node-cron.
 */

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');
const jobService = require('./job.service');

const TTL_MS = config.job.fileTtlMinutes * 60 * 1000;

/**
 * Hapus file dalam folder yang sudah lebih tua dari TTL.
 * @param {string} folderPath
 * @returns {number} jumlah file yang dihapus
 */
function cleanExpiredFiles(folderPath) {
  if (!fs.existsSync(folderPath)) return 0;

  let removed = 0;
  const now = Date.now();
  const entries = fs.readdirSync(folderPath);

  for (const entry of entries) {
    if (entry === '.gitkeep') continue;

    const fullPath = path.join(folderPath, entry);
    try {
      const stat = fs.statSync(fullPath);
      const age = now - stat.mtimeMs;

      if (age > TTL_MS) {
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
        removed++;
      }
    } catch (err) {
      logger.warn('Gagal memeriksa/menghapus file saat cleanup', { file: fullPath, error: err.message });
    }
  }

  return removed;
}

/**
 * Menjalankan satu siklus cleanup penuh: file + job memory.
 */
function runCleanupCycle() {
  const removedTemp = cleanExpiredFiles(config.folders.temp);
  const removedOutput = cleanExpiredFiles(config.folders.output);

  const expiredJobs = jobService.getExpiredJobs(TTL_MS);
  expiredJobs.forEach((job) => jobService.removeJob(job.id));

  if (removedTemp || removedOutput || expiredJobs.length) {
    logger.info('Cleanup cycle selesai', {
      removedTemp,
      removedOutput,
      removedJobs: expiredJobs.length,
    });
  }
}

/**
 * Mendaftarkan cron job cleanup berkala. Dipanggil sekali saat startup (app.js).
 */
function startCleanupScheduler() {
  const intervalMinutes = config.job.cleanupIntervalMinutes;
  const cronExpression = `*/${intervalMinutes} * * * *`;

  cron.schedule(cronExpression, runCleanupCycle);
  logger.info(`Cleanup scheduler aktif (setiap ${intervalMinutes} menit, TTL file ${config.job.fileTtlMinutes} menit)`);
}

module.exports = { startCleanupScheduler, runCleanupCycle, cleanExpiredFiles };
