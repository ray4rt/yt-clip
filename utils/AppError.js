/**
 * utils/AppError.js
 * Custom error class agar seluruh error operasional punya bentuk konsisten:
 * statusCode HTTP, errorCode internal, dan flag isOperational (dikenali/terduga).
 */

const { ERROR_CODES } = require('../config/constants');

class AppError extends Error {
  /**
   * @param {string} message - Pesan human-readable
   * @param {number} statusCode - HTTP status code
   * @param {string} errorCode - Kode error internal (lihat ERROR_CODES)
   * @param {object} [details] - Detail tambahan (opsional, untuk logging)
   */
  constructor(message, statusCode = 500, errorCode = ERROR_CODES.INTERNAL_ERROR, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // Error yang diantisipasi, bukan bug
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errorCode = ERROR_CODES.VALIDATION_ERROR, details = null) {
    return new AppError(message, 400, errorCode, details);
  }

  static notFound(message, errorCode = ERROR_CODES.FILE_NOT_FOUND) {
    return new AppError(message, 404, errorCode);
  }

  static tooManyRequests(message = 'Terlalu banyak request, coba lagi nanti.') {
    return new AppError(message, 429, ERROR_CODES.RATE_LIMITED);
  }

  static internal(message = 'Terjadi kesalahan internal.', details = null) {
    return new AppError(message, 500, ERROR_CODES.INTERNAL_ERROR, details);
  }
}

module.exports = AppError;
