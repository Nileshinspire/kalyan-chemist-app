import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
const DIST = join(process.cwd(), "dist");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.route("**/*", async (ro) => {
  const u = new URL(ro.request().url());
  if (u.hostname !== "kc.local") return ro.continue();
  let p = decodeURIComponent(u.pathname);
  if (p === "/" || p.endsWith(".html")) return ro.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(DIST, "index.html")) });
  const rel = normalize(p).replace(/^([/\\])+/, "");
  const file = join(DIST, rel);
  if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) return ro.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
  return ro.fulfill({ status: 404, body: "nf" });
});
await page.goto("http://kc.local/#/products", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);
const cards = await page.evaluate(() => {
  const grid = document.querySelector(".kc-products-grid");
  if (!grid) return { err: "no grid", text: document.body.innerText.slice(0, 200) };
  const first = grid.firstElementChild;
  return { count: grid.children.length, cls: String(first.className).slice(0, 80) };
});
console.log(JSON.stringify(cards));
try {
  await page.locator(".kc-products-grid > *").first().click({ timeout: 8000 });
  await page.waitForTimeout(3000);
  console.log("URL after click:", page.url());
} catch (e) {
  console.log("click failed:", String(e).slice(0, 160));
}
await browser.close();
