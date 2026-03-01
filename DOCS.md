
Bot not responding troubleshooting
1) Check TELEGRAM_BOT_TOKEN is set in your environment.
2) If you see 409 Conflict in logs, another instance may be running or a webhook is set. Stop other instances, or clear webhook, then restart.
3) This bot prefers polling (getUpdates). If you set TELEGRAM_WEBHOOK_URL without a working PORT listener, it will log a warning and still use polling.
4) Check logs for [polling] starting and [polling] alive lines. If missing, the process may not be starting.
5) If MongoDB connection fails, the bot should still respond to /start and /help; check [db] connect failed logs for details.
