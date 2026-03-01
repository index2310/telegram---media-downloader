import { isAdmin } from "../lib/runtime.js";

export default function register(bot) {
  bot.command("health", async (ctx) => {
    const adminIds = ctx?.state?.adminIds || [];
    const isAllowed = isAdmin(ctx.from?.id, adminIds);

    if (!isAllowed) {
      // If ADMIN_TELEGRAM_USER_IDS is not set, keep this command effectively unavailable.
      // If set but user not admin, keep response generic.
      if (adminIds.length) {
        await ctx.reply("This command is not available.");
      }
      return;
    }

    const info = ctx?.state?.runtimeInfo || {};

    const lines = [
      "Status:",
      `Update mode: ${String(info.updateMode || "unknown")}`,
      `Telegram token set: ${Boolean(info.telegramTokenSet)}`,
      `DB connected: ${Boolean(info.dbConnected)}`,
      `AI enabled: ${Boolean(info.aiEnabled)}`,
      `Uptime seconds: ${Math.floor(process.uptime())}`,
      info.lastError ? `Last error: ${String(info.lastError).slice(0, 300)}` : "Last error: (none)",
    ];

    await ctx.reply(lines.join("\n"));
  });
}
