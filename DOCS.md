This bot downloads public media from TikTok and X links pasted into Telegram and sends the media back into the same chat.

Setup
1) Create a Telegram bot with BotFather and get your token.
2) Copy .env.sample to .env and set TELEGRAM_BOT_TOKEN.
3) Install dependencies and run:
   npm run install:root
   npm run dev

Commands
1) /start
Sends a welcome message and examples of TikTok and X URLs you can paste.

2) /help
Explains supported sources (TikTok and X), public-only limitations, common failure reasons, and privacy notes.

How it works
1) Paste a public TikTok or X link into chat.
2) The bot replies with a status message and updates it as it works (resolving, downloading, uploading).
3) The bot sends back the best available video or images.

Limitations
1) Public content only. Private, locked, age-restricted, geo-blocked, deleted content, or content requiring login cannot be downloaded.
2) Telegram upload limits apply. If a file is too large, Telegram may reject it. The bot will try fallbacks (video to document).
3) If you paste multiple links in one message, the bot only processes the first supported link.

Environment variables
1) TELEGRAM_BOT_TOKEN (required)
Telegram bot token.

Optional tuning
1) RATE_LIMIT_X_PER_MIN (default 6)
2) RATE_LIMIT_TIKTOK_PER_MIN (default 6)
3) HTTP_TIMEOUT_MS (default 20000)
4) HTTP_RETRIES (default 2)
5) HTTP_MAX_REDIRECTS (default 5)
6) MAX_MEDIA_BYTES (default 47185920)

Troubleshooting
1) If you see 409 Conflict in logs, two bot instances are polling at once. The bot will back off and retry.
2) If downloads fail often for one platform, that platform may have changed its public page format. Check logs for the failing URL and HTTP status.
