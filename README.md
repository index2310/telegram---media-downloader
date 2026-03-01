
Bot not responding troubleshooting
1) Verify TELEGRAM_BOT_TOKEN is set.
2) Look for [tg] bot.init ok and [polling] starting in logs.
3) If you see 409 Conflict, you likely have two deployments running at once or a webhook configured. The bot will back off and retry automatically.
4) If you configured TELEGRAM_WEBHOOK_URL but did not expose PORT, the bot will fall back to polling.
5) Use /health (admin-only) to see update mode, DB connectivity, and last error summary.
