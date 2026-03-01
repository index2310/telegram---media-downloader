

Deployment env vars
Most hosting platforms do not mount your local .env file into the running container. This bot will load .env only when it exists locally, but production must use real environment variables set in the host dashboard.

Env var mapping (copy keys exactly)
1) TELEGRAM_BOT_TOKEN (required)
2) MONGODB_URI (optional)
3) ADMIN_TELEGRAM_USER_IDS (optional)
4) COOKMYBOTS_AI_ENDPOINT (optional, requires COOKMYBOTS_AI_KEY)
5) COOKMYBOTS_AI_KEY (optional, requires COOKMYBOTS_AI_ENDPOINT)
6) PORT (optional, default 3000)
7) NODE_ENV (optional, default development)

Debug checklist
1) Set TELEGRAM_BOT_TOKEN in the dashboard and redeploy.
2) Open logs and look for [startup] env. It prints booleans only (no secrets).
3) If you see missing TELEGRAM_BOT_TOKEN, the bot will exit with a clear message.
