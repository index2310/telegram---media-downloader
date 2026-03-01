import "dotenv/config";

import { cfg } from "./lib/config.js";
import { safeErr } from "./lib/safeErr.js";
import { createBot } from "./bot.js";

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

async function boot() {
  console.log("[boot] starting", {
    nodeEnv: process.env.NODE_ENV || "",
    telegramTokenSet: !!cfg.TELEGRAM_BOT_TOKEN,
  });

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error(
      "TELEGRAM_BOT_TOKEN is required. Set it in your environment (or .env for local dev)."
    );
    process.exit(1);
  }

  const bot = createBot(cfg.TELEGRAM_BOT_TOKEN);

  try {
    await bot.init();
  } catch (e) {
    console.warn("[boot] bot.init failed (continuing)", { err: safeErr(e) });
  }

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  } catch (e) {
    console.warn("[boot] deleteWebhook failed (continuing)", { err: safeErr(e) });
  }

  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Welcome and examples" },
      { command: "help", description: "Supported links and troubleshooting" },
    ]);
  } catch (e) {
    console.warn("[boot] setMyCommands failed (continuing)", { err: safeErr(e) });
  }

  let backoffMs = 2000;
  for (;;) {
    try {
      console.log("[polling] start");
      await bot.start();
      console.log("[polling] stopped");
      break;
    } catch (e) {
      const msg = safeErr(e);
      console.error("[polling] error", { err: msg });

      // If another instance is polling, Telegram sends 409. Backoff and retry.
      if (/409|Conflict/i.test(msg)) {
        console.warn("[polling] conflict, backing off", { backoffMs });
        await sleep(backoffMs);
        backoffMs = Math.min(20_000, Math.round(backoffMs * 1.8));
        continue;
      }

      // For other errors, retry with backoff as well (network hiccups)
      await sleep(backoffMs);
      backoffMs = Math.min(20_000, Math.round(backoffMs * 1.8));
    }
  }
}

boot().catch((e) => {
  console.error("[boot] fatal", { err: safeErr(e) });
  process.exit(1);
});
