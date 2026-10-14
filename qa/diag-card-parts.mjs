// Diagnose which part of each product card makes it tall on mobile.
// Usage: node qa/diag-card-parts.mjs [width]
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = join(process.cwd(), process.env.KC_ROOT || "dist-verify");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
const width = Number(process.argv[2] || 375);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.route("**/*", async (r) => {
  const u = new URL(r.request().url());
  if (u.hostname !== "kc.local") return r.continue();
  const p = decodeURIComponent(u.pathname);
  if (p === "/" || p.endsWith(".html")) return r.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(ROOT, "index.html")) });
  const file = join(ROOT, normalize(p).replace(/^([/\\])+/, ""));
  if (file.startsWith(ROOT) && existsSync(file) && statSync(file).isFile()) return r.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
  return r.fulfill({ status: 404, body: "" });
});
await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);
await page.evaluate(async () => {
  const step = Math.round(innerHeight * 0.9);
  for (let y = 0; y < document.body.scrollHeight; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
  scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
});

const out = await page.evaluate(() => {
  const h = (el) => Math.round(el.getBoundingClientRect().height);
  const w = (el) => Math.round(el.getBoundingClientRect().width);
  return [...document.querySelectorAll('[class*="snap-x"]')]
    .map((rail) => {
      const card = rail.firstElementChild;
      if (!card) return null;
      const box = card.getBoundingClientRect();
      if (box.width < 60) return null;
      const head = rail.closest("section")?.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 40) || "?";
      const parts = [...card.querySelectorAll(":scope > *, :scope > * > *")].slice(0, 12).map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().split(" ").slice(0, 6).join(" "),
        h: h(el),
        txt: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34),
      }));
      return { head, cardW: w(card), cardH: h(card), parts };
    })
    .filter(Boolean);
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
