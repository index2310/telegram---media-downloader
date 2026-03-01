import { Bot } from "grammy";

import { safeErr } from "./lib/safeErr.js";
import { extractFirstSupportedUrl } from "./lib/urls.js";
import { checkRateLimit } from "./lib/rateLimit.js";
import { downloadFromUrl } from "./services/downloader.js";
import {
  sendMediaResultToTelegram,
  editStatusSafe,
  setStatusSafe,
} from "./services/telegramSender.js";
import { registerCommands } from "./commands/loader.js";

const inFlightByChat = new Map();

export function createBotProfile() {
  return [
    "Purpose: Download and send back public media from TikTok and X links pasted in chat.",
    "Public commands:",
    "1) /start - Welcome and examples",
    "2) /help - How it works, supported links, limitations",
    "Key rules:",
    "1) Only public media works (no private/locked/age-restricted/geo-blocked/deleted content).",
    "2) The bot processes the first supported URL found in a message.",
    "3) For privacy: the bot only uses the link you provide; it does not ask for logins.",
  ].join("\n");
}

export async function buildBot({ token, runtimeInfo, adminIds }) {
  const bot = new Bot(token);

  // Make runtime info available to commands like /health
  bot.use(async (ctx, next) => {
    ctx.state = ctx.state || {};
    ctx.state.runtimeInfo = runtimeInfo || {};
    ctx.state.adminIds = Array.isArray(adminIds) ? adminIds : [];
    await next();
  });

  bot.api.config.use(async (prev, method, payload, signal) => {
    try {
      return await prev(method, payload, signal);
    } catch (e) {
      console.error("[tg] api error", { method, err: safeErr(e) });
      throw e;
    }
  });

  bot.catch((err) => {
    console.error("[bot.catch]", {
      err: safeErr(err?.error || err),
      updateId: err?.ctx?.update?.update_id,
    });
  });

  // Register commands first (required so they are not swallowed by catch-all)
  await registerCommands(bot);

  bot.on("message:text", async (ctx, next) => {
    const raw = ctx.message?.text || "";
    if (raw.startsWith("/")) return next();

    const chatId = String(ctx.chat?.id || "");
    const userId = String(ctx.from?.id || "");
    const messageId = String(ctx.message?.message_id || "");

    console.log("[update] message:text", {
      chatId,
      userId,
      messageId,
      hasUrlLike: /https?:\/\//i.test(raw),
    });

    if (!chatId) return;

    const extracted = extractFirstSupportedUrl(raw);

    console.log("[url] detect", {
      chatId,
      messageId,
      platform: extracted?.platform || "",
      supported: Boolean(extracted),
      ignoredCount: extracted?.ignoredCount || 0,
    });

    if (!extracted) {
      if (!/https?:\/\//i.test(raw)) return;
      await ctx.reply(
        "I can only download public media from TikTok and X links.\n\nExamples:\nhttps://www.tiktok.com/@user/video/123\nhttps://x.com/user/status/123"
      );
      return;
    }

    if (extracted.ignoredCount > 0) {
      await ctx.reply(
        "I found multiple links. I’ll download the first supported one and ignore the rest."
      );
    }

    if (inFlightByChat.get(chatId)) {
      await ctx.reply("I’m working on your last request—please wait.");
      return;
    }

    const rlKey = `dl:${chatId}:${userId}:${extracted.platform}`;
    const rlOk = checkRateLimit(rlKey, {
      capacity:
        extracted.platform === "x"
          ? Number(process.env.RATE_LIMIT_X_PER_MIN || 6)
          : Number(process.env.RATE_LIMIT_TIKTOK_PER_MIN || 6),
      refillMs: 60_000,
    });

    if (!rlOk) {
      await ctx.reply("You’re doing that a bit too fast. Please wait a minute and try again.");
      return;
    }

    inFlightByChat.set(chatId, true);

    const traceId = `${Date.now()}-${chatId}-${messageId}`;
    const link = extracted.url;

    const startedAt = Date.now();
    console.log("[download] start", {
      traceId,
      platform: extracted.platform,
      url: link,
      chatId,
      userId,
    });

    let statusMsgId = null;
    try {
      const status = await ctx.reply("Fetching media…");
      statusMsgId = status?.message_id || null;

      await setStatusSafe(ctx, chatId, statusMsgId, "Resolving link…");
      const result = await downloadFromUrl(link, {
        platformHint: extracted.platform,
        status: async (t) => {
          await setStatusSafe(ctx, chatId, statusMsgId, t);
        },
        trace: { traceId },
      });

      await setStatusSafe(ctx, chatId, statusMsgId, "Uploading to Telegram…");
      await sendMediaResultToTelegram(ctx, {
        chatId,
        sourceUrl: link,
        result,
        trace: { traceId },
      });

      const ms = Date.now() - startedAt;
      console.log("[download] done", {
        traceId,
        platform: extracted.platform,
        chatId,
        userId,
        ms,
      });

      await editStatusSafe(ctx, chatId, statusMsgId, "Done.");
    } catch (e) {
      const msg = safeErr(e);
      console.error("[download] failed", {
        traceId,
        platform: extracted.platform,
        url: link,
        chatId,
        userId,
        err: msg,
      });

      const publicOnly =
        String(e?.code || "") === "PUBLIC_ONLY" ||
        /public content only/i.test(msg) ||
        /private|locked|age|geo|login|forbidden|not.?found|deleted/i.test(msg);

      if (publicOnly) {
        await ctx.reply(
          "Public content only. This link looks private, restricted, deleted, or requires login."
        );
      } else {
        await ctx.reply(
          "Sorry, I couldn’t download that. If it’s a public TikTok or X post, try again in a minute or send a different link."
        );
      }

      await editStatusSafe(ctx, chatId, statusMsgId, "Failed.");
    } finally {
      inFlightByChat.delete(chatId);
    }
  });

  return bot;
}
