import { resolveTikTokMedia } from "../services/tiktok.js";
import { safeErr } from "../lib/safeErr.js";
import fetch from "node-fetch"; // pastikan node >=18, kalau node lama bisa pakai node-fetch

// --- definisi API23 di sini supaya tidak perlu file baru ---
async function resolveTikTokViaAPI23(videoUrl) {
  const RAPID_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPID_KEY) throw new Error("RapidAPI key missing");

  const RAPID_HOST = "tiktok-video-downloader-api.p.rapidapi.com";
  const endpoint = `https://${RAPID_HOST}/media?videoUrl=${encodeURIComponent(videoUrl)}`;

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

  return {
    kind: "video",
    items: [
      { type: "video", url: data.result.play || data.result.download },
    ],
  };
}

// Contoh fungsi downloadFromUrl
export async function downloadFromUrl(url, { platformHint, status, trace }) {
  const normalizedUrl = String(url || "");
  const platform = platformHint;

  if (platform === "tiktok") {
    try {
      await status?.("Downloading via API23…");

      let result;
      try {
        // Pakai API23 dulu
        result = await resolveTikTokViaAPI23(normalizedUrl);
      } catch (e) {
        console.warn("[downloader] API23 failed, fallback to scrapper", { err: safeErr(e) });
        result = await resolveTikTokMedia(normalizedUrl);
      }

      console.log("[downloader] resolve ok", {
        traceId: trace?.traceId || "",
        platform,
        kind: result.kind,
        itemCount: result.items.length,
      });

      return result;
    } catch (e) {
      const msg = safeErr(e);
      console.error("[downloader] resolve failed", {
        traceId: trace?.traceId || "",
        platform,
        normalizedUrl,
        err: msg,
      });
      throw e;
    }
  }

  throw new Error("UNSUPPORTED_PLATFORM");
}