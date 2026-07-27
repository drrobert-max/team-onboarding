// Stamp a unique build id into the built service worker so its bytes change on
// every deploy. Without this, sw.js is identical release-to-release, the browser
// never detects an update, and open apps keep running stale cached chunks.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const swPath = "dist/public/sw.js";
if (!existsSync(swPath)) {
  console.warn(`[stamp-sw] ${swPath} not found — skipping (did vite build run?)`);
  process.exit(0);
}
const buildId = Date.now().toString(36);
const src = readFileSync(swPath, "utf8");
if (!src.includes("__BUILD_ID__")) {
  console.warn("[stamp-sw] no __BUILD_ID__ placeholder found — leaving sw.js unchanged");
  process.exit(0);
}
writeFileSync(swPath, src.replaceAll("__BUILD_ID__", buildId));
console.log(`[stamp-sw] service worker version -> reform-hub-${buildId}`);
