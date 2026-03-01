export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Supported sources: TikTok and X.\n\nPublic content only: If the post is private, age-restricted, geo-blocked, deleted, or requires login, I can’t download it.\n\nCommon reasons it fails:\n1) The link is not a direct TikTok video link or X status link\n2) The content is restricted or removed\n3) Telegram rejects the upload because the file is too large\n4) Temporary network issues\n\nPrivacy: I don’t ask for logins. I only fetch the public URL you send and return the media into this chat."
    );
  });
}
