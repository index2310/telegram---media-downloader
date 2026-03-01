

Deployment env vars
Hosting environments usually do not provide a .env file at runtime. This bot will try to load a local .env if it exists, but in production you must set environment variables in your hosting dashboard.

Environment variable mapping
Set these keys in your host dashboard exactly as written:

1) TELEGRAM_BOT_TOKEN
Required. Telegram token from BotFather.

2) MONGODB_URI
Optional. If not set, the bot will run with DB features disabled.

3) ADMIN_TELEGRAM_USER_IDS
Optional. Comma-separated Telegram user IDs. If not set, the /health command is effectively unavailable.

4) COOKMYBOTS_AI_ENDPOINT
Optional. Enables AI gateway calls only if COOKMYBOTS_AI_KEY is also set.

5) COOKMYBOTS_AI_KEY
Optional. Enables AI gateway calls only if COOKMYBOTS_AI_ENDPOINT is also set.

6) PORT
Optional. Defaults to 3000.

7) NODE_ENV
Optional. Defaults to development.

Debug checklist
1) Confirm TELEGRAM_BOT_TOKEN is set in the hosting dashboard.
2) Redeploy after changing env vars.
3) Check logs for the single [startup] env line. It shows which env vars are set using booleans only.
4) If the bot exits immediately, the logs will say which required env var is missing.
