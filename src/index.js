import http from "node:http";

import { run } from "@grammyjs/runner";
import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";
import { getDb } from "./lib/db.js";
import { buildBot } from "./bot.js";
import { getLastError, parseAdminIds, setLastError } from "./lib/runtime.js";

process.on("unhandledRejection", (e) => {
  console.error("[process] unhandledRejection", { err: safeErr(e) });
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error("[process] uncaughtException", { err: safeErr(e) });
  process.exit(1);
});

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

let pollRunner = null;
let restartLock = false;

function startHeartbeat() {
  const intervalMs = Number(process.env.HEARTBEAT_MS || 60_000);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

  setInterval(() => {
    const m = process.memoryUsage();
    console.log("[heartbeat]", {
      uptimeS: Math.floor(process.uptime()),
      rssMB: Math.round(m.rss / 1e6),
      heapUsedMB: Math.round(m.heapUsed / 1e6),
    });
  }, intervalMs).unref();
}

async function maybeStartWebhookServer() {
  const port = Number(process.env.PORT || 0);
  if (!port) return { server: null, listening: false, port: 0 };

  const server = http.createServer((req, res) => {
    // This project primarily uses long polling.
    // If a webhook is configured in the future, this server can be extended to receive updates.
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("ok");
  });

  await new Promise((resolve) => server.listen(port, resolve));
  console.log("[http] listening", { port });

  return { server, listening: true, port };
}

async function startPolling(bot, runtimeInfo) {
  let backoffMs = 2000;

  for (;;) {
    try {
      console.log("[polling] starting", { concurrency: 1 });

      // Use runner for stable long polling.
      // Concurrency is kept at 1 to avoid runaway backlog/memory.
      pollRunner = run(bot, { concurrency: 1 });

      runtimeInfo.updateMode = "polling";

      // Small periodic log so we can see it's alive even when idle
      let lastLog = Date.now();
      const tick = setInterval(() => {
        const now = Date.now();
        if (now - lastLog > 60_000) {
          console.log("[polling] alive");
          lastLog = now;
        }
      }, 30_000);
      tick.unref();

      await pollRunner.task();

      console.warn("[polling] runner stopped (will restart)");
    } catch (e) {
      const msg = safeErr(e);
      setLastError(e);
      console.error("[polling] error", { err: msg });

      // Telegram conflict (another instance polling, or webhook set)
      if (/409|Conflict/i.test(msg)) {
        console.warn("[polling] conflict detected", {
          hint: "Another instance may be running, or a webhook is set. Will backoff and retry.",
          backoffMs,
        });

        try {
          // Safe remediation: clear webhook before polling
          await bot.api.deleteWebhook({ drop_pending_updates: true });
          console.log("[polling] deleteWebhook ok");
        } catch (e2) {
          console.warn("[polling] deleteWebhook failed", { err: safeErr(e2) });
        }
      }

      await sleep(backoffMs);
      backoffMs = Math.min(20_000, Math.round(backoffMs * 1.8));
    } finally {
      try {
        pollRunner?.abort?.();
      } catch {}
      pollRunner = null;
    }
  }
}

async function boot() {
  const adminIds = parseAdminIds(process.env.ADMIN_TELEGRAM_USER_IDS);
  const webhookUrl = String(process.env.TELEGRAM_WEBHOOK_URL || "").trim();

  const runtimeInfo = {
    updateMode: "unknown",
    telegramTokenSet: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    dbConnected: false,
    aiEnabled: Boolean(process.env.COOKMYBOTS_AI_ENDPOINT) && Boolean(process.env.COOKMYBOTS_AI_KEY),
    lastError: "",
  };

  console.log("[boot]", {
    nodeEnv: process.env.NODE_ENV || "",
    telegramTokenSet: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    mongodbUriSet: Boolean(process.env.MONGODB_URI),
    cookmybotsAiEndpointSet: Boolean(process.env.COOKMYBOTS_AI_ENDPOINT),
    cookmybotsAiKeySet: Boolean(process.env.COOKMYBOTS_AI_KEY),
    webhookUrlSet: Boolean(webhookUrl),
    portSet: Boolean(process.env.PORT),
    adminIdsConfigured: adminIds.length > 0,
  });

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Set it in your environment (or .env for local dev).");
    process.exit(1);
  }

  startHeartbeat();

  // DB is optional; never block bot boot on DB issues.
  if (process.env.MONGODB_URI) {
    try {
      const db = await getDb(process.env.MONGODB_URI);
      runtimeInfo.dbConnected = Boolean(db);
      console.log("[db] connect ok", { connected: runtimeInfo.dbConnected });
    } catch (e) {
      setLastError(e);
      console.warn("[db] connect failed", { err: safeErr(e) });
      runtimeInfo.dbConnected = false;
    }
  } else {
    console.warn("[db] disabled (MONGODB_URI not set)");
  }

  const { listening } = await maybeStartWebhookServer();

  // Decide update mode.
  // Prefer polling unless webhook is explicitly configured AND an HTTP port is listening.
  const webhookReady = Boolean(webhookUrl) && Boolean(listening);

  const bot = await buildBot({ token: cfg.TELEGRAM_BOT_TOKEN, runtimeInfo, adminIds });

  // Ensure bot.init + set commands are not fatal
  try {
    await bot.init();
    console.log("[tg] bot.init ok", { username: bot.botInfo?.username || "" });
  } catch (e) {
    setLastError(e);
    console.warn("[tg] bot.init failed (continuing)", { err: safeErr(e) });
  }

  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Welcome and examples" },
      { command: "help", description: "Supported links and troubleshooting" },
    ]);
  } catch (e) {
    setLastError(e);
    console.warn("[tg] setMyCommands failed (continuing)", { err: safeErr(e) });
  }

  if (!webhookReady) {
    if (webhookUrl && !listening) {
      console.warn("[webhook] TELEGRAM_WEBHOOK_URL is set but PORT is not listening; falling back to polling");
    } else {
      console.log("[webhook] not configured; using polling");
    }

    // Always clear webhook when polling to avoid conflicts
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      console.log("[tg] deleteWebhook ok");
    } catch (e) {
      setLastError(e);
      console.warn("[tg] deleteWebhook failed (continuing)", { err: safeErr(e) });
    }

    // Keep runtimeInfo updated for /health
    setInterval(() => {
      runtimeInfo.lastError = getLastError();
    }, 5000).unref();

    await startPolling(bot, runtimeInfo);
    return;
  }

  // Webhook mode placeholder: not enabled in this project by default.
  // We log and then still fall back to polling so the bot always works.
  console.warn("[webhook] webhook mode is not implemented in this bot. Falling back to polling.");

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  } catch {}

  setInterval(() => {
    runtimeInfo.lastError = getLastError();
  }, 5000).unref();

  await startPolling(bot, runtimeInfo);
}

boot().catch((e) => {
  console.error("[boot] fatal", { err: safeErr(e) });
  process.exit(1);
});
