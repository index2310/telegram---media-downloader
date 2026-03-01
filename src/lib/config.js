export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // Optional rate limit tuning
  RATE_LIMIT_X_PER_MIN: Number(process.env.RATE_LIMIT_X_PER_MIN || 6),
  RATE_LIMIT_TIKTOK_PER_MIN: Number(process.env.RATE_LIMIT_TIKTOK_PER_MIN || 6),

// Downloader gateway
  MEDIA_DOWNLOAD_ENDPOINT:
    process.env.MEDIA_DOWNLOAD_ENDPOINT ||
    "https://instagram-downloader38.p.rapidapi.com/download",

  MEDIA_DOWNLOAD_KEY: process.env.MEDIA_DOWNLOAD_KEY,

  // Network tuning
  HTTP_TIMEOUT_MS: Number(process.env.HTTP_TIMEOUT_MS || 20_000),
  HTTP_MAX_REDIRECTS: Number(process.env.HTTP_MAX_REDIRECTS || 5),
  HTTP_RETRIES: Number(process.env.HTTP_RETRIES || 2),
  MAX_MEDIA_BYTES: Number(process.env.MAX_MEDIA_BYTES || 45 * 1024 * 1024),
};
