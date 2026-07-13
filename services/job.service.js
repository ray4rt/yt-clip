/**
 * services/job.service.js
 * Mengelola lifecycle "job" (satu proses clip end-to-end).
 * Disimpan in-memory (Map) — cukup untuk single-instance deployment.
 * Setiap job punya EventEmitter sendiri untuk broadcast progress ke SSE listener.
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { JOB_STATUS } = require('../config/constants');

/** @type {Map<string, object>} */
const jobs = new Map();

/** @type {Map<string, EventEmitter>} */
const emitters = new Map();

/**
 * Membuat job baru dengan status awal QUEUED.
 * @param {object} initialData - { url, start, end, resolution, ... }
 * @returns {object} job
 */
function createJob(initialData) {
  const id = uuidv4();
  const job = {
    id,
    status: JOB_STATUS.QUEUED,
    progress: 0,
    stage: 'Menunggu antrian...',
    outputFile: null,
    outputPath: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...initialData,
  };

  jobs.set(id, job);
  emitters.set(id, new EventEmitter());
  return job;
}

/**
 * @param {string} id
 * @returns {object|undefined}
 */
function getJob(id) {
  return jobs.get(id);
}

/**
 * Update sebagian field job, lalu broadcast perubahan ke listener SSE.
 * @param {string} id
 * @param {object} patch
 */
function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;

  Object.assign(job, patch, { updatedAt: Date.now() });
  jobs.set(id, job);

  const emitter = emitters.get(id);
  if (emitter) emitter.emit('update', job);

  return job;
}

/**
 * Mendaftarkan listener untuk perubahan progress job tertentu (dipakai SSE controller).
 * @param {string} id
 * @param {(job: object) => void} listener
 */
function onJobUpdate(id, listener) {
  const emitter = emitters.get(id);
  if (emitter) emitter.on('update', listener);
}

/**
 * @param {string} id
 * @param {(job: object) => void} listener
 */
function offJobUpdate(id, listener) {
  const emitter = emitters.get(id);
  if (emitter) emitter.off('update', listener);
}

/**
 * Hapus job dari memory (dipanggil setelah delete file atau cleanup TTL).
 * @param {string} id
 */
function removeJob(id) {
  jobs.delete(id);
  const emitter = emitters.get(id);
  if (emitter) emitter.removeAllListeners();
  emitters.delete(id);
}

/**
 * Ambil semua job yang sudah selesai (done/error) dan lebih tua dari TTL tertentu.
 * @param {number} ttlMs
 * @returns {object[]}
 */
function getExpiredJobs(ttlMs) {
  const now = Date.now();
  const expired = [];
  for (const job of jobs.values()) {
    const isFinished = job.status === JOB_STATUS.DONE || job.status === JOB_STATUS.ERROR;
    if (isFinished && now - job.updatedAt > ttlMs) {
      expired.push(job);
    }
  }
  return expired;
}

module.exports = {
  createJob,
  getJob,
  updateJob,
  onJobUpdate,
  offJobUpdate,
  removeJob,
  getExpiredJobs,
};
