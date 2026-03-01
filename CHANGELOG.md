# Changelog

All notable changes to this bot project are recorded here.

## 2026-03-01 16:08:08. UTC
- Request: create a simple bot to download media from tiktok and x ,when user paste the link of the media the bot will download and send the media to the chat ,only public media can be downloaded
- Summary: Created a Telegram-only grammY bot that detects the first TikTok or X link in a message, posts a progress status message, downloads public media, and sends it back with Telegram-safe fallbacks (video→document, images→me…
- Files: .env.sample, DOCS.md, README.md, package.json, src/bot.js, src/commands/help.js, src/commands/loader.js, src/commands/start.js, src/index.js, src/lib/config.js, src/lib/http.js, src/lib/rateLimit.js, src/lib/safeErr.js, src/lib/urls.js (+4 more)

