export default function register(bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Send me a public TikTok or X link and I’ll download the media and send it here.\n\nExamples:\nhttps://www.tiktok.com/@scout2015/video/6718335390845095173\nhttps://x.com/jack/status/20\n\nTip: If you paste multiple links in one message, I’ll only process the first supported one."
    );
  });
}
