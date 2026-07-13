{
  "name": "youtube-clipper",
  "version": "1.0.0",
  "description": "Professional YouTube video clipping tool - extract, trim, and export video segments without downloading the full video manually.",
  "main": "app.js",
  "type": "commonjs",
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop ecosystem.config.js",
    "pm2:restart": "pm2 restart ecosystem.config.js",
    "pm2:logs": "pm2 logs youtube-clipper",
    "pm2:delete": "pm2 delete ecosystem.config.js",
    "lint": "eslint . --ext .js",
    "lint:fix": "eslint . --ext .js --fix",
    "clean": "node scripts/clean.js",
    "check:deps": "node scripts/checkDependencies.js",
    "test": "node --test tests/"
  },
  "keywords": [
    "youtube",
    "clipper",
    "video",
    "ffmpeg",
    "yt-dlp",
    "video-editor",
    "nodejs"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.19.2",
    "ejs": "^3.1.10",
    "dotenv": "^16.4.5",
    "axios": "^1.7.7",
    "uuid": "^10.0.0",
    "fluent-ffmpeg": "^2.1.3",
    "ffmpeg-static": "^5.2.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.4.0",
    "express-validator": "^7.2.0",
    "node-cache": "^5.1.2",
    "node-cron": "^3.0.3",
    "multer": "^1.4.5-lts.1",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "sanitize-filename": "^1.6.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.7",
    "eslint": "^8.57.1"
  }
}
