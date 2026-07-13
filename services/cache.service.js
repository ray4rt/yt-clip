/**
 * services/cache.service.js
 * Cache metadata video agar tidak perlu memanggil yt-dlp berulang
 * untuk URL yang sama dalam rentang waktu TTL.
 */

const NodeCache = require('node-cache');
const config = require('../config');

const metadataCache = new NodeCache({
  stdTTL: config.cache.ttlSeconds,
  checkperiod: Math.floor(config.cache.ttlSeconds / 4),
  useClones: false,
});

/**
 * @param {string} videoId
 * @returns {object|undefined}
 */
function getMetadata(videoId) {
  return metadataCache.get(videoId);
}

/**
 * @param {string} videoId
 * @param {object} metadata
 */
function setMetadata(videoId, metadata) {
  metadataCache.set(videoId, metadata);
}

/**
 * @param {string} videoId
 * @returns {boolean}
 */
function hasMetadata(videoId) {
  return metadataCache.has(videoId);
}

function flushAll() {
  metadataCache.flushAll();
}

module.exports = { getMetadata, setMetadata, hasMetadata, flushAll };
