import { isAdmin, getLastError } from "../lib/runtime.js";

function formatUptime() {
  const s = Math.floor(process.uptime());
  return String(s);
}

export default function register(bot) {
  bot.command("health", async (ctx) => {
    const adminIds = ctx?.state?.adminIds || [];
    const isAllowed = isAdmin(ctx.from?.id, adminIds);

    if (!isAllowed) {
      if (adminIds.length) {
        await ctx.reply("This command is not available.");
      }
      return;
    }

    const info = ctx?.state?.runtimeInfo || {};

    const lastError = String(info.lastError || getLastError() || "").slice(0, 400);

    const lines = [
      "Status:",
      `Active mode: ${String(info.updateMode || "unknown")}`,
      `Uptime seconds: ${formatUptime()}`,
      `DB enabled: ${Boolean(info.dbEnabled)}`,
      `DB connected: ${Boolean(info.dbConnected)}`,
      `AI enabled: ${Boolean(info.aiEnabled)}`,
      `Last update received: ${String(info.lastUpdateAt || "") || "(none)"}`,
      `Last handled message: ${String(info.lastHandledAt || "") || "(none)"}`,
      `Last handled chatId: ${String(info.lastHandledChatId || "") || "(none)"}`,
      `Last handled userId: ${String(info.lastHandledUserId || "") || "(none)"}`,
      lastError ? `Last error: ${lastError}` : "Last error: (none)",
    ];

    await ctx.reply(lines.join("\n"));
  });
}
