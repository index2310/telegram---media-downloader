import { cfg } from "../lib/config.js";

export default function register(bot) {
  bot.command("help", async (ctx) => {
    const configured = !!(cfg.MEDIA_DOWNLOAD_ENDPOINT && cfg.MEDIA_DOWNLOAD_KEY);

    const msg =
      "How to use:\n" +
      "1) Paste a TikTok or X link into chat\n" +
      "2) Wait while I fetch, download, and send the media\n\n" +
      "Supported domains:\n" +
      "TikTok: tiktok.com, www.tiktok.com, vt.tiktok.com\n" +
      "X: x.com, www.x.com, twitter.com, www.twitter.com\n\n" +
      "Public only means the post must be viewable without logging in. Protected accounts, private posts, or restricted media will fail.\n\n" +
      "Troubleshooting:\n" +
      "1) Make sure you’re sending a full link that starts with https://\n" +
      "2) If it says rate-limited, wait a bit and try again\n" +
      "3) If it says private or not found, the content is not publicly accessible\n" +
      "4) If upload fails, I’ll try sending as a file instead\n\n" +
      (configured
        ? "Downloader service is configured."
        : "Downloader service is not configured yet (MEDIA_DOWNLOAD_ENDPOINT / MEDIA_DOWNLOAD_KEY missing)."
      );

    await ctx.reply(msg);
  });
}
