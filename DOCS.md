

Bot not responding checklist
1) Confirm TELEGRAM_BOT_TOKEN is set in the hosting dashboard (not just in a local .env file).
2) Check logs for the single line: [startup] env. It shows which env vars are set using booleans only.
3) Make sure you are using exactly one update mode:
   a) Polling mode is default. If you previously set a webhook, polling can be blocked until the webhook is cleared.
   b) Webhook mode is enabled only when PUBLIC_BASE_URL is set.
4) If you see 409 Conflict in logs, another instance is polling or a webhook is still set. The bot will back off and retry.
5) Group chats: if the bot does not respond in a group, check group permissions and Telegram privacy mode (BotFather settings). Some bots only receive commands in groups unless privacy mode is disabled.
6) /health is admin-only. Set ADMIN_TELEGRAM_USER_IDS to your Telegram numeric user id(s) to use it. It reports current mode, uptime, DB connected boolean, AI enabled boolean, and last error summary.
