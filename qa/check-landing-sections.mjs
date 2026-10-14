// Which inline (non-shared) product sections render on the home page, and what
// mobile image band do they use?
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
const ROOT = join(process.cwd(), process.env.KC_ROOT || "dist-verify");
const W = Number(process.argv[2] || 390);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
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

console.log(JSON.stringify(await page.evaluate(() => {
  const text = document.body.innerText;
  const headings = [...document.querySelectorAll("h2")].map((h) => h.textContent.trim());
  const inline = [...document.querySelectorAll("div, section")].length;
  // inline cards = cards with a cart/buy button but no shadcn data-slot
  const cards = [...document.querySelectorAll("div")].filter(
    (d) => /add to cart|buy now|cart/i.test(d.textContent || "") && !d.querySelector('[data-slot="card"]') && d.querySelector("h3") && d.querySelector("img, svg") && d.getBoundingClientRect().width > 80 && d.getBoundingClientRect().width < 300
  );
  const seen = new Set();
  const list = [];
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    const key = `${Math.round(r.width)}x${Math.round(r.height)}|${c.closest("section")?.querySelector("h2")?.textContent?.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const band = c.querySelector('div[class*="aspect-square"], div[class*="h-24"], div[class*="h-32"], div[class*="h-40"]');
    const img = c.querySelector("img");
    const b = band?.getBoundingClientRect();
    const ir = img?.getBoundingClientRect();
    list.push({
      section: c.closest("section")?.querySelector("h2")?.textContent?.trim() || "?",
      card: `${Math.round(r.width)}x${Math.round(r.height)}`,
      band: b ? `${Math.round(b.width)}x${Math.round(b.height)}` : null,
      img: img && ir ? `${Math.round(ir.width)}x${Math.round(ir.height)} ${getComputedStyle(img).objectFit}` : "none",
    });
  }
  return { vw: innerWidth, headings, bestDealsRendered: /Best Deals Right Now/i.test(text), inlineCards: list };
}), null, 1));
await browser.close();
