function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return false;
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function parseAdminIds(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function getBootConfigSummary(cfg) {
  const adminCount = Array.isArray(cfg.ADMIN_TELEGRAM_USER_IDS)
    ? cfg.ADMIN_TELEGRAM_USER_IDS.length
    : 0;

  return {
    nodeEnv: cfg.NODE_ENV,
    port: cfg.PORT,
    telegramTokenSet: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    adminIdsSet: adminCount > 0,
    adminIdsCount: adminCount,
    mongodbUriSet: Boolean(cfg.MONGODB_URI),
    cookmybotsAiEndpointSet: Boolean(cfg.COOKMYBOTS_AI_ENDPOINT),
    cookmybotsAiKeySet: Boolean(cfg.COOKMYBOTS_AI_KEY),
    aiEnabled: Boolean(cfg.AI_ENABLED),
  };
}

export function getConfig(env = process.env) {
  const cfg = {
    NODE_ENV: String(env.NODE_ENV || "development"),
    PORT: toInt(env.PORT, 3000),

    TELEGRAM_BOT_TOKEN: String(env.TELEGRAM_BOT_TOKEN || ""),

    // Optional
    TELEGRAM_WEBHOOK_URL: String(env.TELEGRAM_WEBHOOK_URL || ""),

    // Optional: admin-only features
    ADMIN_TELEGRAM_USER_IDS: parseAdminIds(env.ADMIN_TELEGRAM_USER_IDS),

    // Optional DB (keep behavior: bot runs without DB)
    MONGODB_URI: String(env.MONGODB_URI || ""),

    // Optional rate limit tuning
    RATE_LIMIT_X_PER_MIN: toInt(env.RATE_LIMIT_X_PER_MIN, 6),
    RATE_LIMIT_TIKTOK_PER_MIN: toInt(env.RATE_LIMIT_TIKTOK_PER_MIN, 6),

    // Downloader gateway (optional)
    MEDIA_DOWNLOAD_ENDPOINT: String(env.MEDIA_DOWNLOAD_ENDPOINT || ""),
    MEDIA_DOWNLOAD_KEY: String(env.MEDIA_DOWNLOAD_KEY || ""),

    // Network tuning
    HTTP_TIMEOUT_MS: toInt(env.HTTP_TIMEOUT_MS, 20_000),
    HTTP_MAX_REDIRECTS: toInt(env.HTTP_MAX_REDIRECTS, 5),
    HTTP_RETRIES: toInt(env.HTTP_RETRIES, 2),
    MAX_MEDIA_BYTES: toInt(env.MAX_MEDIA_BYTES, 45 * 1024 * 1024),
    HTTP_USER_AGENT: String(env.HTTP_USER_AGENT || ""),

    // AI gateway (optional; do not crash if missing)
    COOKMYBOTS_AI_ENDPOINT: String(env.COOKMYBOTS_AI_ENDPOINT || ""),
    COOKMYBOTS_AI_KEY: String(env.COOKMYBOTS_AI_KEY || ""),
    AI_TIMEOUT_MS: toInt(env.AI_TIMEOUT_MS, 600_000),
    AI_MAX_RETRIES: toInt(env.AI_MAX_RETRIES, 2),

    // Logs / Heartbeat
    HEARTBEAT_MS: toInt(env.HEARTBEAT_MS, 60_000),

    // RapidAPI (optional; used by downloader fallback)
    RAPIDAPI_KEY: String(env.RAPIDAPI_KEY || ""),
  };

  cfg.AI_ENABLED = Boolean(cfg.COOKMYBOTS_AI_ENDPOINT) && Boolean(cfg.COOKMYBOTS_AI_KEY);
  cfg.WEBHOOK_ENABLED = Boolean(cfg.TELEGRAM_WEBHOOK_URL);

  return cfg;
}

export const cfg = getConfig(process.env);

export function assertRequiredConfig(cfgToCheck) {
  if (!cfgToCheck?.TELEGRAM_BOT_TOKEN) {
    console.error("[boot] missing required env var", {
      key: "TELEGRAM_BOT_TOKEN",
      howToFix: "Set TELEGRAM_BOT_TOKEN in your hosting dashboard environment variables, then redeploy.",
    });
    process.exit(1);
  }
}
