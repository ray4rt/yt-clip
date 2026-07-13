/**
 * ecosystem.config.js
 * Konfigurasi PM2 untuk menjalankan Clipreel di production.
 * Jalankan dengan: pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'youtube-clipper',
      script: 'app.js',
      instances: 1, // Job in-memory (Map) tidak safe untuk cluster mode tanpa shared store (Redis)
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      autorestart: true,
      restart_delay: 3000,
    },
  ],
};
