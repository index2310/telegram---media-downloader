import { fetchWithRetries } from "../lib/http.js";

function extractJsonFromHtml(html) {
  const s = String(html || "");

  // Try SIGI_STATE (common)
  const sigi = s.match(/<script[^>]*id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i);
  if (sigi && sigi[1]) {
    try {
      return JSON.parse(sigi[1]);
    } catch {}
  }

  // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
  const uni = s.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i);
  if (uni && uni[1]) {
    try {
      return JSON.parse(uni[1]);
    } catch {}
  }

  return null;
}

function pickBestVideoUrl(obj) {
  // Heuristics over known TikTok shapes
  // Return a direct mp4 URL if available.
  const candidates = [];

  try {
    const itemModule = obj?.ItemModule || obj?.itemModule;
    if (itemModule && typeof itemModule === "object") {
      const firstKey = Object.keys(itemModule)[0];
      const item = itemModule[firstKey];
      const play = item?.video?.playAddr;
      const download = item?.video?.downloadAddr;
      const bitRates = item?.video?.bitrateInfo;
      if (Array.isArray(bitRates)) {
        for (const b of bitRates) {
          const u = b?.PlayAddr?.UrlList?.[0] || b?.PlayAddr?.UrlList?.[1];
          if (u) candidates.push(String(u));
        }
      }
      if (play) candidates.push(String(play));
      if (download) candidates.push(String(download));

      const images = item?.imagePost?.images;
      if (Array.isArray(images) && images.length) {
        const imageUrls = images
          .map((im) => im?.imageURL?.urlList?.[0] || im?.imageURL?.urlList?.[1])
          .filter(Boolean)
          .map(String);
        if (imageUrls.length) {
          return { type: "images", urls: imageUrls };
        }
      }
    }
  } catch {}

  const uniq = Array.from(new Set(candidates.filter(Boolean)));
  if (uniq.length) return { type: "video", urls: uniq };
  return null;
}

export async function resolveTikTokMedia(url) {
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
    throw new Error(`TIKTOK_HTTP_${res.status}`);
  }

  const html = await res.text();
  const json = extractJsonFromHtml(html);
  if (!json) {
    // TikTok may block scraping or require JS; treat as public-only restriction.
    const e = new Error("Public content only");
    e.code = "PUBLIC_ONLY";
    throw e;
  }

  const picked = pickBestVideoUrl(json);
  if (!picked) {
    const e = new Error("Public content only");
    e.code = "PUBLIC_ONLY";
    throw e;
  }

  if (picked.type === "images") {
    return {
      platform: "tiktok",
      kind: "images",
      items: picked.urls.map((x) => ({ url: x, mime: "image/jpeg" })),
    };
  }

  return {
    platform: "tiktok",
    kind: "video",
    items: [{ url: picked.urls[0], mime: "video/mp4" }],
  };
}
