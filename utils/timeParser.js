/**
 * utils/timeParser.js
 * Konversi & validasi format waktu "HH:MM:SS" atau "MM:SS" <-> detik.
 */

const TIME_REGEX = /^(\d{1,2}:)?\d{1,2}:\d{1,2}$/;

/**
 * Cek apakah string sesuai format waktu yang didukung.
 * @param {string} value
 * @returns {boolean}
 */
function isValidTimeFormat(value) {
  return typeof value === 'string' && TIME_REGEX.test(value.trim());
}

/**
 * Konversi "HH:MM:SS" atau "MM:SS" menjadi total detik.
 * @param {string} time
 * @returns {number}
 */
function timeToSeconds(time) {
  if (!isValidTimeFormat(time)) {
    throw new Error(`Format waktu tidak valid: "${time}". Gunakan HH:MM:SS atau MM:SS.`);
  }

  const parts = time.trim().split(':').map(Number);
  let seconds = 0;

  if (parts.length === 3) {
    const [h, m, s] = parts;
    seconds = h * 3600 + m * 60 + s;
  } else {
    const [m, s] = parts;
    seconds = m * 60 + s;
  }

  return seconds;
}

/**
 * Konversi total detik menjadi format "HH:MM:SS".
 * @param {number} totalSeconds
 * @returns {string}
 */
function secondsToTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * Validasi range clip: start < end, dan tidak melebihi durasi video.
 * @param {number} startSec
 * @param {number} endSec
 * @param {number} videoDurationSec
 * @param {number} maxClipDurationSec
 * @returns {{ valid: boolean, message?: string }}
 */
function validateClipRange(startSec, endSec, videoDurationSec, maxClipDurationSec) {
  if (startSec < 0 || endSec < 0) {
    return { valid: false, message: 'Waktu tidak boleh negatif.' };
  }
  if (startSec >= endSec) {
    return { valid: false, message: 'Waktu mulai (start) harus lebih kecil dari waktu selesai (end).' };
  }
  if (videoDurationSec && endSec > videoDurationSec) {
    return { valid: false, message: 'Waktu selesai (end) melebihi durasi video.' };
  }
  const clipDuration = endSec - startSec;
  if (maxClipDurationSec && clipDuration > maxClipDurationSec) {
    return {
      valid: false,
      message: `Durasi clip maksimal adalah ${secondsToTime(maxClipDurationSec)}.`,
    };
  }
  return { valid: true };
}

module.exports = { isValidTimeFormat, timeToSeconds, secondsToTime, validateClipRange };
