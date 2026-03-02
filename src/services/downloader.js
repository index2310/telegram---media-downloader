import { safeErr } from "../lib/safeErr.js";
import { setLastError } from "../lib/runtime.js";

import { resolveTikTokMedia } from "./tiktok.js";
import { resolveXMedia } from "./x.js";

async function resolveTikTokViaAPI23(videoUrl) {
  const RAPID_KEY = process.env.RAPIDAPI_KEY || "";
  if (!RAPID_KEY) {
    const e = new Error("RapidAPI key missing");
    e.code = "RAPIDAPI_KEY_MISSING";
    throw e;
  }

  const RAPID_HOST = "tiktok-video-downloader-api.p.rapidapi.com";
  const endpoint = `https://${RAPID_HOST}/media?videoUrl=${encodeURIComponent(videoUrl)}`;

  console.log("[rapidapi] start", { host: RAPID_HOST });

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      "x-rapidapi-key": RAPID_KEY,
      "x-rapidapi-host": RAPID_HOST,
    },
  });

  if (!res.ok) throw new Error(`RapidAPI request failed: ${res.status}`);

  const data = await res.json();
  if (!data || !data.result) throw new Error("Invalid API23 response");

  const url = data.result.play || data.result.download;
  if (!url) throw new Error("No media url in API23 response");

  console.log("[rapidapi] ok");

  return {
    platform: "tiktok",
    kind: "video",
    items: [{ url, mime: "video/mp4" }],
  };
}

export async function downloadFromUrl(url, { platformHint = "", status, trace } = {}) {
  const normalizedUrl = String(url || "");
  const platform = String(platformHint || "");

  console.log("[downloader] start", {
    traceId: trace?.traceId || "",
    platform,
  });

  try {
    if (platform === "tiktok") {
      await status?.("Extracting TikTok media…");

      let result;
      try {
        await status?.("Downloading via API23…");
        result = await resolveTikTokViaAPI23(normalizedUrl);
      } catch (e) {
        // Optional feature: RapidAPI. Safe fallback.
        console.warn("[downloader] API23 failed, fallback to TikWM", {
          traceId: trace?.traceId || "",
          err: safeErr(e),
          rapidapiConfigured: Boolean(process.env.RAPIDAPI_KEY),
        });

        await status?.("Downloading via TikWM…");
        result = await resolveTikTokMedia(normalizedUrl);
      }

      console.log("[downloader] resolve ok", {
        traceId: trace?.traceId || "",
        platform,
        kind: result?.kind || "",
        itemCount: Array.isArray(result?.items) ? result.items.length : 0,
      });

      return result;
    }

    if (platform === "x") {
      await status?.("Extracting X media…");
      const result = await resolveXMedia(normalizedUrl);

      console.log("[downloader] resolve ok", {
        traceId: trace?.traceId || "",
        platform,
        kind: result?.kind || "",
        itemCount: Array.isArray(result?.items) ? result.items.length : 0,
      });

      return result;
    }

    const e = new Error("UNSUPPORTED_PLATFORM");
    e.code = "UNSUPPORTED_PLATFORM";
    throw e;
  } catch (e) {
    setLastError(e);
    console.error("[downloader] failed", {
      traceId: trace?.traceId || "",
      platform,
      normalizedUrl,
      err: safeErr(e),
    });
    throw e;
  }
}
