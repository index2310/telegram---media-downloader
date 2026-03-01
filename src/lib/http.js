import { cfg } from "./config.js";
import { safeErr } from "./safeErr.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ua() {
  return (
    process.env.HTTP_USER_AGENT ||
    "Mozilla/5.0 (compatible; MediaLinkBot/1.0; +https://example.invalid)"
  );
}

export async function fetchWithRetries(url, init = {}, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || cfg.HTTP_TIMEOUT_MS || 20_000);
  const retries = Number.isFinite(opts.retries) ? Number(opts.retries) : cfg.HTTP_RETRIES;

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      console.log("[http] fetch start", {
        url: String(url),
        method: init?.method || "GET",
        attempt,
      });

      const res = await fetch(url, {
        redirect: "manual",
        ...init,
        headers: {
          "User-Agent": ua(),
          ...(init.headers || {}),
        },
        signal: ctrl.signal,
      });

      console.log("[http] fetch ok", {
        url: String(url),
        status: res.status,
        attempt,
      });

      return res;
    } catch (e) {
      lastErr = e;
      console.warn("[http] fetch fail", {
        url: String(url),
        attempt,
        err: safeErr(e),
      });

      if (attempt < retries) {
        await sleep(350 * Math.pow(2, attempt));
        continue;
      }

      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr || new Error("HTTP_FAILED");
}

export async function resolveRedirects(startUrl, { maxRedirects = cfg.HTTP_MAX_REDIRECTS } = {}) {
  let url = String(startUrl);
  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetchWithRetries(url, { method: "GET" }, { retries: 0 });
    const status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return url;
      url = new URL(loc, url).toString();
      continue;
    }
    return url;
  }
  return url;
}

export async function downloadToBuffer(url, { maxBytes = cfg.MAX_MEDIA_BYTES } = {}) {
  const res = await fetchWithRetries(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`DOWNLOAD_HTTP_${res.status}`);
  }

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength && contentLength > maxBytes) {
    const e = new Error("FILE_TOO_LARGE");
    e.code = "FILE_TOO_LARGE";
    throw e;
  }

  const ab = await res.arrayBuffer();
  if (ab.byteLength > maxBytes) {
    const e = new Error("FILE_TOO_LARGE");
    e.code = "FILE_TOO_LARGE";
    throw e;
  }

  const contentType = res.headers.get("content-type") || "";
  return { buffer: Buffer.from(ab), contentType };
}
