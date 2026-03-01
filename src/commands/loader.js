import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function registerCommands(bot) {
  const dir = path.dirname(fileURLToPath(import.meta.url));

  const files = fs
    .readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".js") &&
        f !== "loader.js" &&
        !f.startsWith("_") &&
        fs.statSync(path.join(dir, f)).isFile()
    );

  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    const fn = mod?.default || mod?.register;
    if (typeof fn === "function") {
      await fn(bot);
    } else {
      console.warn("[commands] skipped", { file: f });
    }
  }
}
