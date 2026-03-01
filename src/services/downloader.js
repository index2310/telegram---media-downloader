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

export async function downloadFromUrl(inputUrl, { platformHint = "", status = async () => {} } = {}) {
  const originalUrl = String(inputUrl || "");

  await status("Resolving redirects…");
  const normalizedUrl = await resolveRedirects(originalUrl);

  const platform = platformHint || detect(normalizedUrl) || detect(originalUrl);
  if (!platform) {
    const e = new Error("UNSUPPORTED_URL");
    e.code = "UNSUPPORTED_URL";
    throw e;
  }

  console.log("[downloader] detected", { platform, originalUrl, normalizedUrl });

  try {
    await status("Extracting media…");
    if (platform === "tiktok") {
      return await resolveTikTokMedia(normalizedUrl);
    }
    if (platform === "x") {
      return await resolveXMedia(normalizedUrl);
    }
    const e = new Error("UNSUPPORTED_URL");
    e.code = "UNSUPPORTED_URL";
    throw e;
  } catch (e) {
    const msg = safeErr(e);
    console.error("[downloader] resolve failed", { platform, normalizedUrl, err: msg });
    throw e;
  }
}
