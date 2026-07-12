# Clipreel — YouTube Video Clipper

Tools untuk mengambil bagian tertentu (clip) dari video YouTube dan mengekspornya menjadi file video baru — tanpa perlu mengunduh seluruh video secara manual.

Dibangun dengan Node.js + Express, `yt-dlp` untuk pengambilan video, dan FFmpeg untuk pemotongan/encoding. Progress real-time menggunakan Server-Sent Events.

---

## Fitur

- Ambil metadata video (judul, thumbnail, durasi, channel, resolusi, subtitle) tanpa download
- Potong video berdasarkan rentang waktu (`start` – `end`) dengan pilihan resolusi output
- Progress real-time (downloading → clipping → encoding → finished) via SSE
- Cache metadata & source video (tidak download ulang video yang sama)
- Auto-cleanup file setelah 30 menit
- Rate limiting, validasi input, sanitasi filename, proteksi path traversal
- Fitur bonus: convert ke MP3, extract audio, watermark, ubah FPS, compress, crop, burn subtitle, merge clip (lihat `services/ffmpeg.service.js`)

---

## Struktur Project

```
youtube-clipper/
├── app.js                  # Entry point
├── config/                 # Konfigurasi & konstanta
├── routes/                 # Definisi endpoint
├── controllers/             # Request/response handler
├── services/                 # Business logic (yt-dlp, ffmpeg, job, queue, cache, cleanup)
├── middleware/               # Validator, rate limiter, security, error handler
├── utils/                    # Helper murni (validator, logger, sanitizer, dll)
├── views/ + public/          # Frontend (EJS + vanilla JS + CSS)
├── scripts/                   # Script maintenance (checkDependencies, clean)
├── temp/ downloads/ output/ logs/   # Folder runtime (auto-dibersihkan)
```

---

## 1. Instalasi

### Prasyarat
- Node.js ≥ 18 LTS
- Python 3 (untuk instalasi yt-dlp via pip) — opsional jika pakai binary langsung
- FFmpeg (opsional install manual — project sudah menyediakan fallback via `ffmpeg-static`)

### Install dependency Node.js
```bash
git clone <repo-url> youtube-clipper
cd youtube-clipper
npm install
```

### Install FFmpeg (opsional, untuk performa & codec terbaik)

**Ubuntu/Debian**
```bash
sudo apt update && sudo apt install -y ffmpeg
```

**macOS**
```bash
brew install ffmpeg
```

**Windows**
1. Download dari https://www.gyan.dev/ffmpeg/builds/
2. Extract, tambahkan folder `bin` ke PATH
3. Verifikasi: `ffmpeg -version`

> Jika FFmpeg sistem tidak ditemukan, aplikasi otomatis fallback ke binary portable dari package `ffmpeg-static` — tidak perlu langkah manual.

### Install yt-dlp (WAJIB — tidak ada fallback otomatis)

**Via pip (direkomendasikan)**
```bash
python3 -m pip install -U yt-dlp
```

**Via binary langsung**
```bash
# Linux/Mac
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```
Windows: download `yt-dlp.exe` dari [GitHub Releases](https://github.com/yt-dlp/yt-dlp/releases/latest), taruh di folder yang ada di PATH.

**Verifikasi instalasi:**
```bash
yt-dlp --version
ffmpeg -version
```

Atau jalankan script bawaan project:
```bash
npm run check:deps
```

---

## 2. Environment Variables

Salin `.env.example` menjadi `.env` lalu sesuaikan:

```bash
cp .env.example .env
```

| Variable | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port server |
| `NODE_ENV` | `development` | `development` / `production` |
| `BASE_URL` | `http://localhost:3000` | URL dasar aplikasi |
| `TEMP_FOLDER` | `./temp` | Folder file sementara |
| `OUTPUT_FOLDER` | `./output` | Folder hasil clip |
| `DOWNLOAD_FOLDER` | `./downloads` | Folder source video (cache) |
| `LOG_FOLDER` | `./logs` | Folder log aplikasi |
| `YTDLP_PATH` | `yt-dlp` | Path binary yt-dlp (jika tidak di PATH) |
| `FFMPEG_PATH` | *(kosong)* | Path binary FFmpeg custom (opsional) |
| `MAX_CONCURRENT_JOBS` | `2` | Batas proses paralel |
| `FILE_TTL_MINUTES` | `30` | Umur file sebelum auto-dihapus |
| `MAX_CLIP_DURATION_SECONDS` | `1800` | Durasi clip maksimum |
| `CACHE_TTL_SECONDS` | `3600` | TTL cache metadata |
| `RATE_LIMIT_MAX` | `20` | Limit request umum per window |
| `RATE_LIMIT_CLIP_MAX` | `5` | Limit khusus endpoint `/api/clip` |
| `CORS_ORIGIN` | `*` | Origin yang diizinkan |

---

## 3. Menjalankan Project

```bash
npm run dev      # development (auto-reload via nodemon)
npm start         # production
npm run pm2:start  # production via PM2 (daemon + auto-restart)
```

Buka `http://localhost:3000` di browser.

---

## 4. Dokumentasi API

### `POST /api/info`
Mengambil metadata video.

```bash
curl -X POST http://localhost:3000/api/info \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=xxxxxxxxxxx"}'
```

Response:
```json
{
  "success": true,
  "cached": false,
  "data": {
    "id": "xxxxxxxxxxx",
    "title": "Judul Video",
    "thumbnail": "https://...",
    "duration": 180,
    "durationLabel": "00:03:00",
    "channel": "Nama Channel",
    "availableResolutions": ["1080p", "720p", "480p"],
    "estimatedSizeLabel": "45.20 MB",
    "hasSubtitles": true,
    "subtitleLanguages": ["en", "id"]
  }
}
```

### `POST /api/clip`
Memulai proses clipping (async, langsung mengembalikan `jobId`).

```bash
curl -X POST http://localhost:3000/api/clip \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://youtube.com/watch?v=xxxxxxxxxxx",
    "start": "00:01:15",
    "end": "00:02:40",
    "resolution": "720p"
  }'
```

Response (`202 Accepted`):
```json
{
  "success": true,
  "message": "Job clip berhasil didaftarkan.",
  "data": { "jobId": "a1b2c3d4-...", "statusUrl": "/api/status/a1b2c3d4-..." }
}
```

### `GET /api/status/:id`
Server-Sent Events — streaming progress real-time.

```bash
curl -N http://localhost:3000/api/status/a1b2c3d4-...
```

Contoh event:
```
data: {"id":"a1b2c3d4-...","status":"downloading","progress":40,"stage":"Downloading... 40%"}

data: {"id":"a1b2c3d4-...","status":"done","progress":100,"stage":"Finished.","outputFile":"judul-video_01m15s.mp4"}
```

### `GET /api/download/:id`
Mengunduh file hasil clip (hanya tersedia jika status = `done`).

### `DELETE /api/delete/:id`
Menghapus file hasil clip beserta job-nya dari memory.

```bash
curl -X DELETE http://localhost:3000/api/delete/a1b2c3d4-...
```

---

## 5. Error Handling

Semua error dikembalikan dalam format konsisten:
```json
{
  "success": false,
  "error": { "code": "VIDEO_PRIVATE", "message": "Video ini bersifat privat dan tidak bisa diakses." }
}
```

Kode error yang ditangani: `INVALID_URL`, `VIDEO_PRIVATE`, `VIDEO_UNAVAILABLE`, `VIDEO_AGE_RESTRICTED`, `COPYRIGHT_BLOCKED`, `YTDLP_FAILED`, `FFMPEG_FAILED`, `INVALID_TIME_RANGE`, `JOB_NOT_FOUND`, `FILE_NOT_FOUND`, `TIMEOUT`, `VALIDATION_ERROR`, `RATE_LIMITED`. Aplikasi tidak akan crash — seluruh error operasional ditangkap oleh global error handler, dan `uncaughtException`/`unhandledRejection` di-log lalu proses di-restart dengan aman (idealnya di-supervisi PM2).

---

## 6. Build & Deployment

Project ini tidak memerlukan build step (murni Node.js CommonJS). Untuk deployment:

```bash
npm install --omit=dev
cp .env.example .env   # sesuaikan untuk production
npm run pm2:start
pm2 save
pm2 startup            # agar auto-start saat server reboot
```

Disarankan menjalankan di belakang reverse proxy (nginx) dengan `proxy_buffering off;` pada route `/api/status/` agar SSE tidak di-buffer.

---

## 7. Optimasi yang Diterapkan

- **Reuse source video**: video sumber yang sama tidak didownload ulang untuk clip berbeda (disimpan di `downloads/`, key berdasar `videoId + resolution`).
- **Cache metadata**: hasil `yt-dlp -j` di-cache di memory (`node-cache`) selama `CACHE_TTL_SECONDS`.
- **Queue dengan concurrency limit**: mencegah CPU/RAM overload saat banyak request clip bersamaan (`MAX_CONCURRENT_JOBS`).
- **Streaming**: download file (`res.download`) menggunakan stream, bukan load ke memory.
- **Auto-cleanup**: `node-cron` membersihkan file & job kadaluarsa secara berkala.

---

## Lisensi

MIT
