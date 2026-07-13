/**
 * services/queue.service.js
 * Queue in-memory sederhana untuk membatasi jumlah proses (download/ffmpeg)
 * yang berjalan paralel, agar CPU/RAM tidak overload saat banyak request masuk.
 *
 * Desain: FIFO queue + worker pool dengan concurrency tetap.
 * Bisa di-upgrade ke bull/bullmq + Redis untuk multi-instance scaling tanpa
 * mengubah kontrak (add) di layer atasnya.
 */

const config = require('../config');
const logger = require('../utils/logger');

class TaskQueue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Menambahkan task ke antrian.
   * @param {() => Promise<void>} taskFn - Fungsi async yang menjalankan job
   * @param {string} [label] - Label untuk logging
   */
  add(taskFn, label = 'task') {
    this.queue.push({ taskFn, label });
    this._processNext();
  }

  _processNext() {
    if (this.running >= this.concurrency) return;
    const next = this.queue.shift();
    if (!next) return;

    this.running++;
    logger.debug(`Queue: menjalankan "${next.label}"`, {
      running: this.running,
      waiting: this.queue.length,
    });

    Promise.resolve()
      .then(() => next.taskFn())
      .catch((err) => {
        logger.error(`Queue: task "${next.label}" gagal`, { error: err.message });
      })
      .finally(() => {
        this.running--;
        this._processNext();
      });
  }

  getStats() {
    return { running: this.running, waiting: this.queue.length, concurrency: this.concurrency };
  }
}

const clipQueue = new TaskQueue(config.job.maxConcurrentJobs);

module.exports = clipQueue;
