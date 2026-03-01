import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

let loaded = false;

export function loadEnvBestEffort() {
  if (loaded) return { attempted: true, loaded: false, path: "" };
  loaded = true;

  // Best-effort only. In hosting, .env typically doesn't exist.
  const cwdPath = path.resolve(process.cwd(), ".env");

  let usedPath = "";
  let didLoad = false;

  try {
    if (fs.existsSync(cwdPath)) {
      const r = dotenv.config({ path: cwdPath });
      if (!r.error) {
        usedPath = cwdPath;
        didLoad = true;
      }
    }
  } catch {
    // ignore
  }

  // Also try alongside src/ for some local layouts
  if (!didLoad) {
    try {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const repoRootGuess = path.resolve(here, "../../");
      const altPath = path.resolve(repoRootGuess, ".env");
      if (fs.existsSync(altPath)) {
        const r = dotenv.config({ path: altPath });
        if (!r.error) {
          usedPath = altPath;
          didLoad = true;
        }
      }
    } catch {
      // ignore
    }
  }

  if (didLoad) {
    console.log("[env] loaded .env", { path: usedPath });
  } else {
    console.log("[env] no .env loaded", { note: "ok in production; use dashboard env vars" });
  }

  return { attempted: true, loaded: didLoad, path: usedPath };
}
