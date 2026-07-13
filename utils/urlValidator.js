/**
 * utils/urlValidator.js
 * Validasi & ekstraksi video ID dari URL YouTube.
 */

const { YOUTUBE_URL_REGEX } = require('../config/constants');

/**
 * Cek apakah string adalah URL YouTube yang valid.
 * @param {string} url
 * @returns {boolean}
 */
function isValidYoutubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return YOUTUBE_URL_REGEX.test(url.trim());
}

/**
 * Ekstrak video ID (11 karakter) dari berbagai format URL YouTube.
 * Mendukung: watch?v=, youtu.be/, shorts/, live/
 * @param {string} url
 * @returns {string|null}
 */
function extractVideoId(url) {
  if (!isValidYoutubeUrl(url)) return null;

  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /shorts\/([\w-]{11})/,
    /live\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Normalisasi URL ke bentuk standar watch?v=... agar konsisten untuk cache key.
 * @param {string} url
 * @returns {string|null}
 */
function normalizeUrl(url) {
  const id = extractVideoId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

module.exports = { isValidYoutubeUrl, extractVideoId, normalizeUrl };
