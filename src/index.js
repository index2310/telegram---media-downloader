import { Bot, GrammyError, HttpError } from "grammy";

import { loadCommands } from "./commands/loader.js";
import { createBotProfile } from "./lib/botProfile.js";
import { getConfig } from "./lib/config.js";
import { connectDb } from "./lib/db.js";
import { safeErr } from "./lib/safeErr.js";

const cfg = getConfig(process.env);

console.log("[startup] env present:", {
  TELEGRAM_BOT_TOKEN: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  MONGODB_URI: Boolean(process.env.MONGODB_URI),
  COOKMYBOTS_AI_ENDPOINT: Boolean(process.env.COOKMYBOTS_AI_ENDPOINT),
  COOKMYBOTS_AI_KEY: Boolean(process.env.COOKMYBOTS_AI_KEY),
});

if (!cfg.TELEGRAM_BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

// DB is optional for some flows, but we attempt to connect at startup.
let db = null;
try {
  db = await connectDb(cfg);
} catch (e) {
  console.warn("[db] connect failed:", safeErr(e));
}

const bot = new Bot(cfg.TELEGRAM_BOT_TOKEN);

// Attach profile/config/db to context
bot.use(async (ctx, next) => {
  ctx.state = ctx.state || {};
  ctx.state.cfg = cfg;
  ctx.state.db = db;
  ctx.state.profile = createBotProfile(cfg);
  await next();
});

await loadCommands(bot, cfg);

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", safeErr(e));
  }
});

console.log("[bot] starting polling...");
await bot.start();
