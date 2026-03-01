import { safeErr } from "../lib/safeErr.js";
import { resolveRedirects } from "../lib/http.js";
import { resolveTikTokMedia } from "./tiktok.js";
import { resolveXMedia } from "./x.js";

function detect(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h === "tiktok.com" || h.endsWith(".tiktok.com") || h === "vm.tiktok.com") return "tiktok";
    if (h === "x.com" || h.endsWith(".x.com") || h === "twitter.com" || h.endsWith(".twitter.com") || h === "t.co") return "x";
    return "";
  } catch {
    return "";
  }
}

export async function downloadFromUrl(inputUrl, { platformHint = "", status = async () => {}, trace = {} } = {}) {
  const originalUrl = String(inputUrl || "");

  console.log("[downloader] start", {
    traceId: trace.traceId || "",
    platformHint: platformHint || "",
    originalUrl,
  });

  await status("Resolving redirects…");
  const normalizedUrl = await resolveRedirects(originalUrl);

  const platform = platformHint || detect(normalizedUrl) || detect(originalUrl);
  if (!platform) {
    const e = new Error("UNSUPPORTED_URL");
    e.code = "UNSUPPORTED_URL";
    console.warn("[downloader] unsupported", {
      traceId: trace.traceId || "",
      originalUrl,
      normalizedUrl,
    });
    throw e;
  }

  console.log("[downloader] detected", {
    traceId: trace.traceId || "",
    platform,
    originalUrl,
    normalizedUrl,
  });

  try {
    await status("Extracting media…");
    let result;

    if (platform === "tiktok") {
      result = await resolveTikTokMedia(normalizedUrl);
    } else if (platform === "x") {
      result = await resolveXMedia(normalizedUrl);
    } else {
      const e = new Error("UNSUPPORTED_URL");
      e.code = "UNSUPPORTED_URL";
      throw e;
    }

    console.log("[downloader] resolve ok", {
      traceId: trace.traceId || "",
      platform,
      kind: result?.kind || "",
      itemCount: Array.isArray(result?.items) ? result.items.length : 0,
    });

    return result;
  } catch (e) {
    const msg = safeErr(e);
    console.error("[downloader] resolve failed", {
      traceId: trace.traceId || "",
      platform,
      normalizedUrl,
      err: msg,
    });
    throw e;
  }
}
