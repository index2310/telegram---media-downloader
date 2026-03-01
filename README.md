Telegram bot that downloads public media from TikTok and X links.

Requirements
Node.js >= 18.

How to run
1) Copy .env.sample to .env and set TELEGRAM_BOT_TOKEN
2) npm run build
3) npm start

Development
1) Copy .env.sample to .env and set TELEGRAM_BOT_TOKEN
2) npm run dev

Notes
1) .env is loaded by Node via --env-file=.env in the start/dev scripts.
2) The project may still use dotenv internally in some modules without breaking anything.
3) Public content only.
4) Telegram file limits apply.

Commands
1) /start
2) /help

More details are in DOCS.md.
