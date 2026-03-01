export const cfg = {
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL || '',
  PORT: Number(process.env.PORT || 3000),
  ADMIN_TELEGRAM_USER_IDS: (process.env.ADMIN_TELEGRAM_USER_IDS || '').split(',').map(id => id.trim()),

  // Optional rate limit tuning
  RATE_LIMIT_X_PER_MIN: Number(process.env.RATE_LIMIT_X_PER_MIN || 6),
  RATE_LIMIT_TIKTOK_PER_MIN: Number(process.env.RATE_LIMIT_TIKTOK_PER_MIN || 6),

  // Downloader gateway
  MEDIA_DOWNLOAD_ENDPOINT: process.env.MEDIA_DOWNLOAD_ENDPOINT || '',
  MEDIA_DOWNLOAD_KEY: process.env.MEDIA_DOWNLOAD_KEY || '',

  // Network tuning
  HTTP_TIMEOUT_MS: Number(process.env.HTTP_TIMEOUT_MS || 20_000),
  HTTP_MAX_REDIRECTS: Number(process.env.HTTP_MAX_REDIRECTS || 5),
  HTTP_RETRIES: Number(process.env.HTTP_RETRIES || 2),
  MAX_MEDIA_BYTES: Number(process.env.MAX_MEDIA_BYTES || 45 * 1024 * 1024),
  HTTP_USER_AGENT: process.env.HTTP_USER_AGENT || '',

  // AI gateway
  COOKMYBOTS_AI_ENDPOINT: process.env.COOKMYBOTS_AI_ENDPOINT || '',
  COOKMYBOTS_AI_KEY: process.env.COOKMYBOTS_AI_KEY || '',
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS || 600_000),
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES || 2),

  // Logs / Heartbeat
  HEARTBEAT_MS: Number(process.env.HEARTBEAT_MS || 60_000),

  // RapidAPI key
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || '',
};\