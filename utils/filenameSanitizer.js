/**
 * utils/filenameSanitizer.js
 * Membersihkan judul video / string apapun agar aman dipakai sebagai nama file.
 */

const sanitize = require('sanitize-filename');

/**
 * Ubah judul menjadi slug: lowercase, spasi -> dash, buang karakter berbahaya.
 * @param {string} title
 * @param {number} [maxLength=60]
 * @returns {string}
 */
function slugify(title, maxLength = 60) {
  if (!title) return 'video';

  const clean = sanitize(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return (clean || 'video').substring(0, maxLength);
}

/**
 * Format detik menjadi label singkat, mis. 80 detik -> "01m20s"
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTimestampLabel(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
}

/**
 * Bangun nama file output final: judul-video_timestamp.mp4
 * @param {string} title
 * @param {number} startSeconds
 * @returns {string}
 */
function buildOutputFilename(title, startSeconds) {
  const slug = slugify(title);
  const label = formatTimestampLabel(startSeconds);
  return `${slug}_${label}.mp4`;
}

module.exports = { slugify, formatTimestampLabel, buildOutputFilename };
