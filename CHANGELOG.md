# Changelog

All notable changes to this bot project are recorded here.

## 2026-03-01 16:29:37. UTC
- Request: fix installation problem by change the package.json line to this { "name": "cookmybots-telegram-bot", "version": "0.1.0", "private": true, "type": "module", "engines": { "node": ">=18" }, "scripts": { "install:root": "b…
- Summary: Replaced root package.json to match your provided JSON exactly (scripts, deps, engines, type: module). Updated README.md and DOCS.md to instruct npm run build, npm start, and npm run dev; added Node >=18 requirement; an…
- Files: .env.sample, DOCS.md, README.md, package.json

## 2026-03-01 16:27:55. UTC
- Request: change the package.json to this { "name": "cookmybots-telegram-bot", "version": "0.1.0", "private": true, "type": "module", "engines": { "node": ">=18" }, "scripts": { "install:root": "bash -lc \"set -e; if [ -f package…
- Summary: Updated package.json exactly as provided (including start/dev using node --env-file=.env) and removed the import "dotenv/config" line from src/index.js. No other behavior or logic was changed.
- Files: .env.sample, package.json, src/index.js

## 2026-03-01 16:08:08. UTC
- Request: create a simple bot to download media from tiktok and x ,when user paste the link of the media the bot will download and send the media to the chat ,only public media can be downloaded
- Summary: Created a Telegram-only grammY bot that detects the first TikTok or X link in a message, posts a progress status message, downloads public media, and sends it back with Telegram-safe fallbacks (video→document, images→me…
- Files: .env.sample, DOCS.md, README.md, package.json, src/bot.js, src/commands/help.js, src/commands/loader.js, src/commands/start.js, src/index.js, src/lib/config.js, src/lib/http.js, src/lib/rateLimit.js, src/lib/safeErr.js, src/lib/urls.js (+4 more)

