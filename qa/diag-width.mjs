// Diagnose why one card in the mobile Value Deals rail is wider than its siblings.
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
const ROOT = join(process.cwd(), process.env.KC_ROOT || "dist-verify");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: Number(process.argv[2] || 360), height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.route("**/*", async (r) => {
  const u = new URL(r.request().url());
  if (u.hostname !== "kc.local") return r.continue();
  const p = decodeURIComponent(u.pathname);
  if (p === "/" || p.endsWith(".html")) return r.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(ROOT, "index.html")) });
  const f = join(ROOT, normalize(p).replace(/^([/\\])+/, ""));
  if (f.startsWith(ROOT) && existsSync(f) && statSync(f).isFile()) return r.fulfill({ status: 200, contentType: MIME[extname(f)] || "application/octet-stream", body: readFileSync(f) });
  return r.fulfill({ status: 404, body: "" });
});
await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400)); });

const out = await page.evaluate(() => {
  const res = [];
  for (const rail of document.querySelectorAll('[class*="snap-x"]')) {
    const head = rail.closest("section")?.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 30) || "?";
    const items = [...rail.children];
    if (!items.length) continue;
    const rows = items.map((it) => {
      const r = it.getBoundingClientRect();
      if (r.width < 60) return null;
      const card = it.querySelector('[data-slot="card"]') || it;
      const probe = (sel, label) => {
        const el = card.querySelector(sel);
        if (!el) return null;
        return { label, min: Math.round(el.getBoundingClientRect().width), txt: (el.textContent || "").trim().slice(0, 20) };
      };
      return {
        item: it.getBoundingClientRect().width,
        minW: getComputedStyle(it).minWidth,
        w: getComputedStyle(it).width,
        cls: it.className.slice(0, 60),
        parts: [
          probe("h3", "name"),
          probe("h3 + p", "mfr"),
          probe('div[class*="flex-wrap"]', "badges"),
          probe('div[class*="items-baseline"]', "price"),
          probe("button", "btn1"),
          probe("button:last-of-type", "btnLast"),
        ],
      };
    }).filter(Boolean);
    res.push({ head, rows });
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
