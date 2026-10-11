import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
const DIST = join(process.cwd(), "dist");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
const route = process.argv[2] || "#/products";
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
await page.goto(`http://kc.local/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4500);
const out = await page.evaluate(() => {
  const res = { text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300), small: [], dots: [] };
  for (const el of document.querySelectorAll("a[href], button, [role=button]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width < 34 && r.height < 34) {
      res.small.push({
        tag: el.tagName.toLowerCase(),
        w: Math.round(r.width), h: Math.round(r.height),
        cls: String(el.className).slice(0, 90),
        label: el.getAttribute("aria-label") || "",
        txt: (el.textContent || "").trim().slice(0, 26),
        parent: String(el.parentElement?.className || "").slice(0, 70),
        gp: String(el.parentElement?.parentElement?.className || "").slice(0, 70),
      });
    }
  }
  return res;
});
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
await browser.close();
