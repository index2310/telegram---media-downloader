export async function resolveTikTokMedia(url) {
  const u = String(url || "").trim();
  if (!u) {
    const e = new Error("Invalid URL");
    e.code = "INVALID_URL";
    throw e;
  }

  const endpoint = `https://www.tikwm.com/api/?url=${encodeURIComponent(u)}`;

  console.log("[tikwm] request", endpoint);

  let res;
  try {
    res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.error("[tikwm] network error", err?.message || err);
    throw new Error("TikWM network failed");
  }

  if (!res.ok) {
    console.error("[tikwm] http error", res.status);
    throw new Error(`TIKWM_HTTP_${res.status}`);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("Invalid TikWM response");
  }

  console.log("[tikwm] response", {
    code: json?.code,
    hasData: Boolean(json?.data),
  });

  if (!json?.data) {
    const e = new Error("Public content only");
    e.code = "PUBLIC_ONLY";
    throw e;
  }

  const videoUrl =
    json?.data?.play ||
    json?.data?.wmplay ||
    json?.data?.hdplay ||
    "";

  if (!videoUrl) {
    const e = new Error("Video not found");
    e.code = "VIDEO_NOT_FOUND";
    throw e;
  }

  return {
    platform: "tiktok",
    kind: "video",
    items: [{ url: videoUrl, mime: "video/mp4" }],
  };
}