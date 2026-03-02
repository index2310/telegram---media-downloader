import { loadEnvBestEffort } from "./lib/env.js";

// Must happen before any module reads process.env
loadEnvBestEffort();

import http from "node:http";

import express from "express";
import { webhookCallback } from "grammy";
import { run } from "@grammyjs/runner";

import {
  cfg,
  assertRequiredConfig,
  getBootConfigSummary,
  getWebhookConfigSummary,
} from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";
import { connectDb } from "./lib/db.js";
import { buildBot } from "./bot.js";
import {
  getLastError,
  parseAdminIds,
  setLastError,
  markLastUpdateReceived,
  markLastHandledMessage,
} from "./lib/runtime.js";

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
    console.log("[mem]", {
      rssMB: Math.round(m.rss / 1e6),
      heapUsedMB: Math.round(m.heapUsed / 1e6),
    });
  }, intervalMs).unref();
}

async function startPolling(bot, runtimeInfo) {
  let backoffMs = 2000;

  for (;;) {
    try {
      console.log("[polling] start", { concurrency: 1 });
      pollRunner = run(bot, { concurrency: 1 });
      runtimeInfo.updateMode = "polling";

      let lastAliveLogAt = 0;
      const aliveTick = setInterval(() => {
        const now = Date.now();
        if (now - lastAliveLogAt >= 60_000) {
          console.log("[polling] alive", {
            lastUpdateAt: runtimeInfo.lastUpdateAt || "",
            lastHandledAt: runtimeInfo.lastHandledAt || "",
          });
          lastAliveLogAt = now;
        }
      }, 15_000);
      aliveTick.unref();

      await pollRunner.task();

      console.warn("[polling] runner stopped (will restart)");
    } catch (e) {
      const msg = safeErr(e);
      setLastError(e);
      console.error("[polling] error", { err: msg });

      if (/409|Conflict/i.test(msg)) {
        console.warn("[polling] conflict detected", {
          hint: "Another instance may be polling or a webhook is set. Backing off and retrying.",
          backoffMs,
        });

        try {
          await bot.api.deleteWebhook({ drop_pending_updates: true });
          console.log("[polling] deleteWebhook ok");
        } catch (e2) {
          setLastError(e2);
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

async function startWebhookServer(bot, runtimeInfo) {
  const PORT = Number(cfg.PORT || 0);
  const app = express();

  // Health probe for infra. Not the Telegram /health command.
  app.get("/", (_req, res) => {
    res.status(200).type("text/plain").send("ok");
  });

  // Telegram webhook endpoint
  app.post(
    cfg.TELEGRAM_WEBHOOK_PATH,
    webhookCallback(bot, "express", {
      secretToken: cfg.TELEGRAM_WEBHOOK_SECRET || undefined,
    })
  );

  // Keep server alive for platform requirements.
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log("[webhook] http listening", {
    port: PORT,
    path: cfg.TELEGRAM_WEBHOOK_PATH,
  });

  // Register webhook at Telegram
  try {
    await bot.api.setWebhook(cfg.TELEGRAM_WEBHOOK_URL, {
      secret_token: cfg.TELEGRAM_WEBHOOK_SECRET || undefined,
      drop_pending_updates: true,
    });
    console.log("[webhook] setWebhook ok", {
      urlSet: Boolean(cfg.TELEGRAM_WEBHOOK_URL),
      path: cfg.TELEGRAM_WEBHOOK_PATH,
    });
  } catch (e) {
    setLastError(e);
    console.error("[webhook] setWebhook failed", { err: safeErr(e) });
    console.warn("[webhook] falling back to polling");

    // Best effort cleanup
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: true });
    } catch {}

    await startPolling(bot, runtimeInfo);
  }

  runtimeInfo.updateMode = "webhook";
  return server;
}

async function boot() {
  const adminIds = parseAdminIds(cfg.ADMIN_TELEGRAM_USER_IDS);

  const runtimeInfo = {
    updateMode: "unknown",
    telegramTokenSet: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    dbEnabled: Boolean(cfg.MONGODB_URI),
    dbConnected: false,
    aiEnabled: Boolean(cfg.AI_ENABLED),
    lastError: "",
    lastUpdateAt: "",
    lastHandledAt: "",
    lastHandledChatId: "",
    lastHandledUserId: "",
  };

  const aiEnabled = Boolean(cfg.COOKMYBOTS_AI_ENDPOINT) && Boolean(cfg.COOKMYBOTS_AI_KEY);

  // Startup sanity summary (no secrets)
  console.log("[startup] env", {
    ...getBootConfigSummary(cfg),
    ADMIN_TELEGRAM_USER_IDS: adminIds.length > 0,
    PUBLIC_BASE_URL: Boolean(cfg.PUBLIC_BASE_URL),
    AI_ENABLED: aiEnabled,
    ...getWebhookConfigSummary(cfg),
  });

  assertRequiredConfig(cfg);

  startHeartbeat();

  // DB connect is optional
  if (cfg.MONGODB_URI) {
    try {
      const db = await connectDb(cfg.MONGODB_URI);
      runtimeInfo.dbConnected = Boolean(db);
      console.log("[db] connect ok", { connected: runtimeInfo.dbConnected });
    } catch (e) {
      setLastError(e);
      runtimeInfo.dbConnected = false;
      console.warn("[db] connect failed", { err: safeErr(e) });
    }
  } else {
    console.warn("[db] disabled (no MONGODB_URI)");
  }

  const bot = await buildBot({ token: cfg.TELEGRAM_BOT_TOKEN, runtimeInfo, adminIds });

  // Global update received hook + periodic update counts
  const updateCounts = { batch: 0 };
  bot.use(async (ctx, next) => {
    try {
      markLastUpdateReceived(runtimeInfo, ctx);
      updateCounts.batch += 1;

      // Log update basics (no text content)
      console.log("[update] received", {
        type: Object.keys(ctx.update || {})[1] || "unknown",
        chatId: String(ctx.chat?.id || ""),
        fromId: String(ctx.from?.id || ""),
        hasText: Boolean(ctx.message?.text),
      });

      await next();
    } catch (e) {
      setLastError(e);
      console.error("[update] middleware error", { err: safeErr(e) });
      throw e;
    }
  });

  setInterval(() => {
    if (updateCounts.batch > 0) {
      console.log("[updates] batch", { count: updateCounts.batch });
      updateCounts.batch = 0;
    }
    runtimeInfo.lastError = getLastError();
  }, 30_000).unref();

  // Message handled marker (best effort)
  bot.use(async (ctx, next) => {
    await next();
    if (ctx.message?.message_id) {
      markLastHandledMessage(runtimeInfo, ctx);
    }
  });

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
      { command: "health", description: "Admin-only diagnostics" },
    ]);
  } catch (e) {
    setLastError(e);
    console.warn("[tg] setMyCommands failed (continuing)", { err: safeErr(e) });
  }

  if (cfg.WEBHOOK_ENABLED) {
    console.log("[mode] webhook enabled", { path: cfg.TELEGRAM_WEBHOOK_PATH });
    await startWebhookServer(bot, runtimeInfo);
    return;
  }

  console.log("[mode] polling enabled");

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    console.log("[tg] deleteWebhook ok");
  } catch (e) {
    setLastError(e);
    console.warn("[tg] deleteWebhook failed (continuing)", { err: safeErr(e) });
  }

  await startPolling(bot, runtimeInfo);
}

boot().catch((e) => {
  console.error("[boot] fatal", { err: safeErr(e) });
  process.exit(1);
});
