/**
 * utils/fileHelper.js
 * Helper operasi filesystem yang aman terhadap path traversal.
 */

const fs = require('fs');
const path = require('path');
const AppError = require('./AppError');
const { ERROR_CODES } = require('../config/constants');

/**
 * Bangun path aman di dalam base directory tertentu.
 * Menolak jika hasil resolve keluar dari baseDir (mencegah ../../ traversal).
 * @param {string} baseDir
 * @param {string} filename
 * @returns {string} absolute path yang aman
 */
function safeJoin(baseDir, filename) {
  const target = path.normalize(path.join(baseDir, filename));
  const base = path.normalize(baseDir);

  if (!target.startsWith(base)) {
    throw AppError.badRequest('Nama file tidak valid (terdeteksi path traversal).', ERROR_CODES.VALIDATION_ERROR);
  }

  return target;
}

/**
 * Cek keberadaan file secara async-safe.
 * @param {string} filePath
 * @returns {boolean}
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Hapus file jika ada, tidak melempar error jika file tidak ditemukan.
 * @param {string} filePath
 */
function safeDelete(filePath) {
  try {
    if (fileExists(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (err) {
    throw AppError.internal(`Gagal menghapus file: ${err.message}`);
  }
}

/**
 * Dapatkan ukuran file dalam bytes.
 * @param {string} filePath
 * @returns {number}
 */
function getFileSize(filePath) {
  if (!fileExists(filePath)) return 0;
  return fs.statSync(filePath).size;
}

/**
 * Format bytes menjadi string human-readable (KB/MB/GB).
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Cek sisa disk space di partition tempat folder berada.
 * Menggunakan fs.statfs (Node 18.15+). Fallback: return null jika tidak didukung OS.
 * @param {string} folderPath
 * @returns {Promise<{ freeBytes: number, totalBytes: number } | null>}
 */
function checkDiskSpace(folderPath) {
  return new Promise((resolve) => {
    if (typeof fs.statfs !== 'function') {
      resolve(null);
      return;
    }
    fs.statfs(folderPath, (err, stats) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve({
        freeBytes: stats.bfree * stats.bsize,
        totalBytes: stats.blocks * stats.bsize,
      });
    });
  });
}

/**
 * Pastikan folder ada, buat jika belum.
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = {
  safeJoin,
  fileExists,
  safeDelete,
  getFileSize,
  formatBytes,
  checkDiskSpace,
  ensureDir,
};
