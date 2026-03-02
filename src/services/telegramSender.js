import { InputFile } from "grammy";
import { safeErr } from "../lib/safeErr.js";
import { downloadToBuffer } from "../lib/http.js";
import { setLastError } from "../lib/runtime.js";

export async function editStatusSafe(ctx, chatId, messageId, text) {
  if (!chatId || !messageId) return;
  try {
    await ctx.api.editMessageText(Number(chatId), Number(messageId), text);
  } catch (e) {
    setLastError(e);
    console.warn("[tg] editMessageText failed", { err: safeErr(e) });
  }
}

export async function setStatusSafe(ctx, chatId, messageId, text) {
  return editStatusSafe(ctx, chatId, messageId, text);
}

async function safeSendTextFallback(ctx, chatId, text, sourceUrl) {
  const msg = sourceUrl ? `${text}\n${String(sourceUrl)}` : text;
  try {
    console.log("[tg] sendMessage fallback start", { chatId });
    await ctx.api.sendMessage(Number(chatId), msg);
    console.log("[tg] sendMessage fallback ok", { chatId });
  } catch (e) {
    setLastError(e);
    console.error("[tg] sendMessage fallback failed", { chatId, err: safeErr(e) });
  }
}

async function sendVideoWithFallback(ctx, chatId, buffer, filename, caption, sourceUrl) {
  try {
    console.log("[tg] sendVideo start", { chatId, bytes: buffer?.length || 0 });
    await ctx.api.sendVideo(Number(chatId), new InputFile(buffer, filename), {
      caption,
    });
    console.log("[tg] sendVideo ok", { chatId });
    return { ok: true, method: "sendVideo" };
  } catch (e) {
    setLastError(e);
    console.warn("[tg] sendVideo failed", {
      chatId,
      err: safeErr(e),
    });
  }

  try {
    console.log("[tg] sendDocument start (video fallback)", {
      chatId,
      bytes: buffer?.length || 0,
    });
    await ctx.api.sendDocument(Number(chatId), new InputFile(buffer, filename), {
      caption,
    });
    console.log("[tg] sendDocument ok (video fallback)", { chatId });
    return { ok: true, method: "sendDocument" };
  } catch (e) {
    setLastError(e);
    console.error("[tg] sendDocument failed (video)", { chatId, err: safeErr(e) });
    await safeSendTextFallback(
      ctx,
      chatId,
      "I couldn’t upload the video to Telegram. Here is the source link:",
      sourceUrl
    );
    return { ok: false, method: "sendMessage" };
  }
}

async function sendPhotoWithFallback(ctx, chatId, buffer, filename, caption, urlFallback, sourceUrl) {
  try {
    console.log("[tg] sendPhoto start", { chatId, bytes: buffer?.length || 0 });
    await ctx.api.sendPhoto(Number(chatId), new InputFile(buffer, filename), {
      caption,
    });
    console.log("[tg] sendPhoto ok", { chatId });
    return { ok: true, method: "sendPhoto" };
  } catch (e) {
    setLastError(e);
    console.warn("[tg] sendPhoto failed", { chatId, err: safeErr(e) });
  }

  if (urlFallback) {
    try {
      console.log("[tg] sendPhoto by URL start", { chatId });
      await ctx.api.sendPhoto(Number(chatId), urlFallback, { caption });
      console.log("[tg] sendPhoto by URL ok", { chatId });
      return { ok: true, method: "sendPhotoUrl" };
    } catch (e) {
      setLastError(e);
      console.warn("[tg] sendPhoto by URL failed", { chatId, err: safeErr(e) });
    }
  }

  try {
    console.log("[tg] sendDocument start (image fallback)", {
      chatId,
      bytes: buffer?.length || 0,
    });
    await ctx.api.sendDocument(Number(chatId), new InputFile(buffer, filename), {
      caption,
    });
    console.log("[tg] sendDocument ok (image fallback)", { chatId });
    return { ok: true, method: "sendDocument" };
  } catch (e) {
    setLastError(e);
    console.error("[tg] sendDocument failed (image)", { chatId, err: safeErr(e) });
    await safeSendTextFallback(
      ctx,
      chatId,
      "I couldn’t upload the image to Telegram. Here is the source link:",
      sourceUrl || urlFallback
    );
    return { ok: false, method: "sendMessage" };
  }
}

export async function sendMediaResultToTelegram(ctx, { chatId, sourceUrl, result, trace = {} }) {
  const caption = "Source: " + String(sourceUrl);

  console.log("[send] start", {
    traceId: trace.traceId || "",
    chatId,
    kind: result?.kind || "",
    itemCount: Array.isArray(result?.items) ? result.items.length : 0,
  });

  if (!result || !result.kind || !Array.isArray(result.items) || !result.items.length) {
    const e = new Error("NO_MEDIA");
    setLastError(e);
    throw e;
  }

  try {
    if (result.kind === "video") {
      const item = result.items[0];
      console.log("[send] download bytes start", { traceId: trace.traceId || "", urlSet: Boolean(item?.url) });
      const { buffer } = await downloadToBuffer(item.url);
      console.log("[send] download bytes ok", { traceId: trace.traceId || "", bytes: buffer?.length || 0 });

      const out = await sendVideoWithFallback(ctx, chatId, buffer, "video.mp4", caption, sourceUrl);
      console.log("[send] done", {
        traceId: trace.traceId || "",
        chatId,
        ok: out.ok,
        method: out.method,
      });
      return;
    }

    if (result.kind === "images") {
      if (result.items.length > 1) {
        try {
          console.log("[tg] sendMediaGroup start", { chatId, count: result.items.length });
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
          console.log("[tg] sendMediaGroup ok", { chatId });
          console.log("[send] done", { traceId: trace.traceId || "", chatId, ok: true, method: "sendMediaGroup" });
          return;
        } catch (e) {
          setLastError(e);
          console.warn("[tg] sendMediaGroup failed, fallback to sequential", {
            chatId,
            err: safeErr(e),
          });
        }
      }

      for (let i = 0; i < result.items.length; i++) {
        const it = result.items[i];
        const { buffer } = await downloadToBuffer(it.url);
        const cap = i === 0 ? caption : "Source: " + String(sourceUrl);
        await sendPhotoWithFallback(ctx, chatId, buffer, `image-${i + 1}.jpg`, cap, it.url, sourceUrl);
      }

      console.log("[send] done", { traceId: trace.traceId || "", chatId, ok: true, method: "sequentialPhotos" });
      return;
    }

    const e = new Error("UNSUPPORTED_MEDIA_KIND");
    setLastError(e);
    throw e;
  } catch (e) {
    setLastError(e);
    console.error("[send] failed", { traceId: trace.traceId || "", chatId, err: safeErr(e) });
    await safeSendTextFallback(ctx, chatId, "I couldn’t deliver the media. Here is the source link:", sourceUrl);
    throw e;
  }
}
