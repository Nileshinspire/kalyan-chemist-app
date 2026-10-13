// Report every product-card text node that is visibly truncated (its content
// is taller than the clamped box) at a few mobile widths. Run:
//   node qa/diag-clamp.mjs
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = join(process.cwd(), process.env.KC_ROOT || "dist-verify");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const width of [320, 360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
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
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const s = Math.round(innerHeight * 0.9);
    for (let y = 0; y < document.body.scrollHeight; y += s) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
  const out = await page.evaluate(() => {
    const clamped = [];
    let checked = 0;
    for (const el of document.querySelectorAll("h3, p, span")) {
      if (!el.closest('[data-slot="card"], .group.rounded-2xl')) continue;
      const txt = (el.textContent || "").trim();
      if (!txt || el.children.length) continue;
      checked++;
      if (el.scrollHeight > el.clientHeight + 1) clamped.push({ tag: el.tagName, txt: txt.slice(0, 44), sh: el.scrollHeight, ch: el.clientHeight });
    }
    const cutButtons = [...document.querySelectorAll('[data-slot="card"] button, .group.rounded-2xl button')]
      .filter((b) => /buy now|cart|out of stock/i.test(b.textContent || ""))
      .filter((b) => b.scrollWidth > b.clientWidth + 1)
      .map((b) => ({ txt: (b.textContent || "").trim().slice(0, 20), sw: b.scrollWidth, cw: b.clientWidth }));
    return { checked, clamped, cutButtons };
  });
  console.log(`W=${width} checked=${out.checked} truncated=${JSON.stringify(out.clamped)} cutButtons=${JSON.stringify(out.cutButtons)}`);
  await ctx.close();
}
await browser.close();
