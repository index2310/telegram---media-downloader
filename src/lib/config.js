function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseAdminIds(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function trimSlash(u) {
  return String(u || "").replace(/\/+$/g, "");
}

function buildWebhookPath(secretMaybe) {
  const s = String(secretMaybe || "").trim();
  const suffix = s ? s : "telegram";
  return "/webhook/" + encodeURIComponent(suffix);
}

export function getBootConfigSummary(cfg) {
  const adminCount = Array.isArray(cfg.ADMIN_TELEGRAM_USER_IDS)
    ? cfg.ADMIN_TELEGRAM_USER_IDS.length
    : 0;

  return {
    TELEGRAM_BOT_TOKEN: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    ADMIN_TELEGRAM_USER_IDS: adminCount > 0,
    MONGODB_URI: Boolean(cfg.MONGODB_URI),
    PUBLIC_BASE_URL: Boolean(cfg.PUBLIC_BASE_URL),
    COOKMYBOTS_AI_ENDPOINT: Boolean(cfg.COOKMYBOTS_AI_ENDPOINT),
    COOKMYBOTS_AI_KEY: Boolean(cfg.COOKMYBOTS_AI_KEY),
    AI_ENABLED: Boolean(cfg.AI_ENABLED),
  };
}

export function getWebhookConfigSummary(cfg) {
  return {
    WEBHOOK_ENABLED: Boolean(cfg.WEBHOOK_ENABLED),
    TELEGRAM_WEBHOOK_SECRET: Boolean(cfg.TELEGRAM_WEBHOOK_SECRET),
    TELEGRAM_WEBHOOK_URL: Boolean(cfg.TELEGRAM_WEBHOOK_URL),
    TELEGRAM_WEBHOOK_PATH: String(cfg.TELEGRAM_WEBHOOK_PATH || ""),
    PORT: Number(cfg.PORT || 0),
  };
}

export function getConfig(env = process.env) {
  const base = trimSlash(env.PUBLIC_BASE_URL || "");
  const secret = String(env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const webhookPath = buildWebhookPath(secret);
  const webhookUrl = base ? base + webhookPath : "";

  const cfg = {
    NODE_ENV: String(env.NODE_ENV || "development"),
    PORT: toInt(env.PORT, 3000),

    TELEGRAM_BOT_TOKEN: String(env.TELEGRAM_BOT_TOKEN || ""),

    // Optional: admin-only features
    ADMIN_TELEGRAM_USER_IDS: parseAdminIds(env.ADMIN_TELEGRAM_USER_IDS),

    // Optional DB (keep behavior: bot runs without DB)
    MONGODB_URI: String(env.MONGODB_URI || ""),

    // Optional rate limit tuning
    RATE_LIMIT_X_PER_MIN: toInt(env.RATE_LIMIT_X_PER_MIN, 6),
    RATE_LIMIT_TIKTOK_PER_MIN: toInt(env.RATE_LIMIT_TIKTOK_PER_MIN, 6),

    // Network tuning
    HTTP_TIMEOUT_MS: toInt(env.HTTP_TIMEOUT_MS, 20_000),
    HTTP_MAX_REDIRECTS: toInt(env.HTTP_MAX_REDIRECTS, 5),
    HTTP_RETRIES: toInt(env.HTTP_RETRIES, 2),
    MAX_MEDIA_BYTES: toInt(env.MAX_MEDIA_BYTES, 45 * 1024 * 1024),
    HTTP_USER_AGENT: String(env.HTTP_USER_AGENT || ""),

    // Optional AI gateway (do not crash if missing)
    COOKMYBOTS_AI_ENDPOINT: String(env.COOKMYBOTS_AI_ENDPOINT || ""),
    COOKMYBOTS_AI_KEY: String(env.COOKMYBOTS_AI_KEY || ""),
    AI_TIMEOUT_MS: toInt(env.AI_TIMEOUT_MS, 600_000),
    AI_MAX_RETRIES: toInt(env.AI_MAX_RETRIES, 2),

    // Logs / Heartbeat
    HEARTBEAT_MS: toInt(env.HEARTBEAT_MS, 60_000),

    // Webhook mode (optional)
    PUBLIC_BASE_URL: base,
    TELEGRAM_WEBHOOK_SECRET: secret,
    TELEGRAM_WEBHOOK_PATH: webhookPath,
    TELEGRAM_WEBHOOK_URL: webhookUrl,

    // RapidAPI (optional)
    RAPIDAPI_KEY: String(env.RAPIDAPI_KEY || ""),
  };

  cfg.AI_ENABLED = Boolean(cfg.COOKMYBOTS_AI_ENDPOINT) && Boolean(cfg.COOKMYBOTS_AI_KEY);

  // Webhook is enabled ONLY when PUBLIC_BASE_URL is set.
  cfg.WEBHOOK_ENABLED = Boolean(cfg.PUBLIC_BASE_URL);

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
