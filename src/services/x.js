import { fetchWithRetries } from "../lib/http.js";

function extractOgImage(html) {
  const m = String(html || "").match(
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i
  );
  if (m && m[1]) return m[1];
  return "";
}

function extractOgVideo(html) {
  const m = String(html || "").match(
    /<meta[^>]+property="og:video"[^>]+content="([^"]+)"/i
  );
  if (m && m[1]) return m[1];
  return "";
}

export async function resolveXMedia(url) {
  const u = String(url || "");

  const res = await fetchWithRetries(u, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      const e = new Error("Public content only");
      e.code = "PUBLIC_ONLY";
      throw e;
    }
    throw new Error(`X_HTTP_${res.status}`);
  }

  const html = await res.text();

  // Lightweight approach: rely on OpenGraph. For many tweets with video,
  // og:video is not a direct mp4, but sometimes it is.
  const ogVideo = extractOgVideo(html);
  if (ogVideo) {
    return {
      platform: "x",
      kind: "video",
      items: [{ url: ogVideo, mime: "video/mp4" }],
    };
  }

  const ogImage = extractOgImage(html);
  if (ogImage) {
    return {
      platform: "x",
      kind: "images",
      items: [{ url: ogImage, mime: "image/jpeg" }],
    };
  }

  const e = new Error("Public content only");
  e.code = "PUBLIC_ONLY";
  throw e;
}
