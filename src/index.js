import { loadEnvBestEffort } from "./lib/env.js";

// Must happen before any module reads process.env
loadEnvBestEffort();

import http from "node:http";

import { run } from "@grammyjs/runner";
import { cfg, assertRequiredConfig, getBootConfigSummary } from "./lib/config.js";
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

function startHeartbeat() {
  const intervalMs = Number(cfg.HEARTBEAT_MS || 60_000);
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
  const port = Number(cfg.PORT || 0);
  if (!port) return { server: null, listening: false, port: 0 };

  const server = http.createServer((req, res) => {
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

      pollRunner = run(bot, { concurrency: 1 });
      runtimeInfo.updateMode = "polling";

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

      if (/409|Conflict/i.test(msg)) {
        console.warn("[polling] conflict detected", {
          hint: "Another instance may be running, or a webhook is set. Will backoff and retry.",
          backoffMs,
        });

        try {
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
  const adminIds = parseAdminIds(cfg.ADMIN_TELEGRAM_USER_IDS);
  const webhookUrl = String(cfg.TELEGRAM_WEBHOOK_URL || "").trim();

  const runtimeInfo = {
    updateMode: "unknown",
    telegramTokenSet: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    dbConnected: false,
    aiEnabled: Boolean(cfg.AI_ENABLED),
    lastError: "",
  };

  // Single structured startup summary (no secrets)
  console.log("[startup] env", {
    ...getBootConfigSummary(cfg),
    runningMode: "polling",
    webhookUrlSet: Boolean(webhookUrl),
  });

  assertRequiredConfig(cfg);

  startHeartbeat();

  if (cfg.MONGODB_URI) {
    try {
      const db = await getDb(cfg.MONGODB_URI);
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

  const webhookReady = Boolean(webhookUrl) && Boolean(listening);

  const bot = await buildBot({ token: cfg.TELEGRAM_BOT_TOKEN, runtimeInfo, adminIds });

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
      console.warn(
        "[webhook] TELEGRAM_WEBHOOK_URL is set but PORT is not listening; falling back to polling"
      );
    } else {
      console.log("[webhook] not configured; using polling");
    }

    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      console.log("[tg] deleteWebhook ok");
    } catch (e) {
      setLastError(e);
      console.warn("[tg] deleteWebhook failed (continuing)", { err: safeErr(e) });
    }

    setInterval(() => {
      runtimeInfo.lastError = getLastError();
    }, 5000).unref();

    await startPolling(bot, runtimeInfo);
    return;
  }

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
