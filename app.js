/**
 * app.js
 * Entry point aplikasi YouTube Clipper.
 */

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const compression = require('compression');

const config = require('./config');
const logger = require('./utils/logger');
const applySecurity = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const apiRoutes = require('./routes');
const { ensureDir } = require('./utils/fileHelper');
const { startCleanupScheduler } = require('./services/cleanup.service');
const { printReport } = require('./scripts/checkDependencies');

const app = express();

// ===== Pastikan folder runtime tersedia =====
Object.values(config.folders).forEach(ensureDir);

// ===== Security & Performance Middleware =====
applySecurity(app);
app.use(compression());

// ===== Body Parser =====
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== HTTP Request Logger =====
app.use(
  morgan('short', {
    stream: { write: (message) => logger.debug(message.trim()) },
  })
);

// ===== View Engine =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== Static Assets =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== Frontend Route =====
app.get('/', (req, res) => {
  res.render('index', { baseUrl: config.server.baseUrl });
});

// ===== API Routes =====
app.use('/api', apiRoutes);

// ===== Health Check =====
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ===== 404 & Global Error Handler (harus di paling akhir) =====
app.use(notFound);
app.use(errorHandler);

// ===== Startup Sequence =====
function start() {
  const depsOk = printReport();

  if (!depsOk) {
    logger.warn('Aplikasi tetap dijalankan meskipun ada dependency eksternal yang hilang. Beberapa fitur mungkin gagal.');
  }

  const server = app.listen(config.server.port, () => {
    logger.info(`YouTube Clipper berjalan di ${config.server.baseUrl} (env: ${config.server.env})`);
    startCleanupScheduler();
  });

  // ===== Graceful Shutdown =====
  const shutdown = (signal) => {
    logger.info(`Menerima sinyal ${signal}, menutup server...`);
    server.close(() => {
      logger.info('Server berhasil ditutup.');
      process.exit(0);
    });

    // Paksa keluar jika graceful shutdown macet > 10 detik
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ===== Global Safety Net (jangan pernah crash diam-diam) =====
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason: reason?.message || reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    // Uncaught exception tetap berbahaya untuk state aplikasi; keluar dengan aman
    // agar proses manager (PM2) bisa me-restart dengan state bersih.
    shutdown('uncaughtException');
  });

  return server;
}

// Jalankan hanya jika file ini dieksekusi langsung (bukan di-require, mis. saat testing)
if (require.main === module) {
  start();
}

module.exports = app;
