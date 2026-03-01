function extractUrls(text) {
  const t = String(text || "");
  const matches = t.match(/https?:\/\/[^\s<>()]+/gi) || [];
  return matches.map((u) => u.replace(/[\]\[),.?!;:'\"]+$/g, ""));
}

function detectPlatform(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    const isTikTok =
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com") ||
      host === "vm.tiktok.com";

    const isX =
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com") ||
      host === "t.co";

    if (isTikTok) return "tiktok";
    if (isX) return "x";
    return "";
  } catch {
    return "";
  }
}

export function extractFirstSupportedUrl(text) {
  const urls = extractUrls(text);
  if (!urls.length) return null;

  let ignoredCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const platform = detectPlatform(url);
    if (platform) {
      ignoredCount = Math.max(0, urls.length - (i + 1));
      return { url, platform, ignoredCount };
    }
  }

  return null;
}
