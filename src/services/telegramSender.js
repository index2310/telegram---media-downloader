import { InputFile } from "grammy";
import { safeErr } from "../lib/safeErr.js";
import { downloadToBuffer } from "../lib/http.js";

export async function editStatusSafe(ctx, chatId, messageId, text) {
  if (!chatId || !messageId) return;
  try {
    await ctx.api.editMessageText(Number(chatId), Number(messageId), text);
  } catch (e) {
    // ignore; message may be gone
    console.warn("[tg] editMessageText failed", { err: safeErr(e) });
  }
}

export async function setStatusSafe(ctx, chatId, messageId, text) {
  // same as edit, but throttled could be added later
  return editStatusSafe(ctx, chatId, messageId, text);
}

async function sendVideoWithFallback(ctx, chatId, buffer, filename, caption, sourceUrl) {
  try {
    console.log("[tg] sendVideo", { chatId });
    await ctx.api.sendVideo(Number(chatId), new InputFile(buffer, filename), {
      caption,
    });
    return;
  } catch (e) {
    console.warn("[tg] sendVideo failed, fallback to sendDocument", {
      err: safeErr(e),
    });
  }

  try {
    console.log("[tg] sendDocument", { chatId });
    await ctx.api.sendDocument(Number(chatId), new InputFile(buffer, filename), {
      caption,
    });
  } catch (e) {
    console.error("[tg] sendDocument failed", { err: safeErr(e) });
    await ctx.api.sendMessage(
      Number(chatId),
      "I downloaded the media but Telegram rejected the upload. Here is the source link:\n" +
        String(sourceUrl)
    );
  }
}

async function sendPhotoWithFallback(ctx, chatId, buffer, filename, caption, urlFallback) {
  try {
    console.log("[tg] sendPhoto", { chatId });
    await ctx.api.sendPhoto(Number(chatId), new InputFile(buffer, filename), {
      caption,
    });
    return;
  } catch (e) {
    console.warn("[tg] sendPhoto failed", { err: safeErr(e) });
  }

  if (urlFallback) {
    try {
      console.log("[tg] sendPhoto by URL", { chatId });
      await ctx.api.sendPhoto(Number(chatId), urlFallback, { caption });
      return;
    } catch (e) {
      console.warn("[tg] sendPhoto by URL failed", { err: safeErr(e) });
    }
  }

  try {
    console.log("[tg] sendDocument (image fallback)", { chatId });
    await ctx.api.sendDocument(Number(chatId), new InputFile(buffer, filename), {
      caption,
    });
  } catch (e) {
    console.error("[tg] sendDocument (image) failed", { err: safeErr(e) });
    await ctx.api.sendMessage(
      Number(chatId),
      "I couldn’t upload the image. Here is the source link:\n" + String(urlFallback || "")
    );
  }
}

export async function sendMediaResultToTelegram(ctx, { chatId, sourceUrl, result }) {
  const caption = "Source: " + String(sourceUrl);

  if (!result || !result.kind || !Array.isArray(result.items) || !result.items.length) {
    throw new Error("NO_MEDIA");
  }

  if (result.kind === "video") {
    const item = result.items[0];
    const { buffer } = await downloadToBuffer(item.url);
    await sendVideoWithFallback(ctx, chatId, buffer, "video.mp4", caption, sourceUrl);
    return;
  }

  // Images: try media group first if >1
  if (result.kind === "images") {
    if (result.items.length > 1) {
      try {
        console.log("[tg] sendMediaGroup", { chatId, count: result.items.length });
        const media = [];
        for (let i = 0; i < result.items.length; i++) {
          const it = result.items[i];
          const { buffer } = await downloadToBuffer(it.url);
          media.push({
            type: "photo",
            media: new InputFile(buffer, `image-${i + 1}.jpg`),
            caption: i === 0 ? caption : undefined,
          });
        }
        await ctx.api.sendMediaGroup(Number(chatId), media);
        return;
      } catch (e) {
        console.warn("[tg] sendMediaGroup failed, fallback to sequential", {
          err: safeErr(e),
        });
      }
    }

    for (let i = 0; i < result.items.length; i++) {
      const it = result.items[i];
      const { buffer } = await downloadToBuffer(it.url);
      const cap = i === 0 ? caption : "Source: " + String(sourceUrl);
      await sendPhotoWithFallback(ctx, chatId, buffer, `image-${i + 1}.jpg`, cap, it.url);
    }
    return;
  }

  throw new Error("UNSUPPORTED_MEDIA_KIND");
}
