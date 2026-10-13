/// Compare Apollo Pharmacy mobile product cards with Kalyan Chemist.
// Usage: node qa/apollo-vs-kalyan.mjs
//        KC_ROOT=dist node qa/apollo-vs-kalyan.mjs
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const KC_ROOT = process.env.KC_ROOT || join(process.cwd(), "dist-verify");
const SHOTS = join(process.cwd(), "qa/shots");
mkdirSync(SHOTS, { recursive: true });
import { mkdirSync } from "node:fs";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

const apolloProbe = () => {
  const card = [...document.querySelectorAll("a[href*=\"/otc/\"], a[href*=\"/product/\"], a[href*=\"/shop-by-category/\"]])
    .map((a) => a.getBoundingClientRect())
    .filter((r) => r.width > 40 && r.height > 40 && r.width <= window.innerWidth)
    .slice(0, 1)[0] ?? null;
  const mrp = [...document.querySelectorAll("span")].find((s) => /\d+\.\d+\s*₹|\u20b9\d+/.test(s.textContent ?? ""));
  return {
    vw: window.innerWidth,
    scrollW: document.documentElement.scrollWidth,
    apolloCard: card ? { w: Math.round(card.width), h: Math.round(card.height), x: Math.round(card.x), y: Math.round(card.y) } : null,
    apolloMrp: mrp ? mrp.textContent.trim() : null,
  };
};

const kcProbe = () => {
  const box = (el) =>
    el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
  const cards = [...document.querySelectorAll('[data-slot="card"]')].filter((c) => /\buy now|cart|out of stock/i.test(c.textContent ?? ""));
  const first = cards[0];
  const band = first?.querySelector('div[class*="h-28"], div[class*="h-40"], div[class*="h-32"], div[class*="relative"]')?.getBoundingClientRect();
  const img = first?.querySelector("img");
  const buttons = [...first?.querySelectorAll("button") ?? []].map((b) => ({ l: (b.textContent ?? "").trim().slice(0, 14), ...box(b) }));
  return {
    vw: window.innerWidth,
    scrollW: document.documentElement.scrollWidth,
    kcCard: first ? { w: Math.round(first.getBoundingClientRect().width), h: Math.round(first.getBoundingClientRect().height), x: Math.round(first.getBoundingClientRect().left) } : null,
    kcBand: band ? { w: Math.round(band.width), h: Math.round(band.height) } : null,
    kcImg: img ? { w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height), x: Math.round(img.getBoundingClientRect().left) } : null,
    kcButtons: buttons.length ? buttons : null,
    kcCt: first ? first.textContent.slice(0, 120).replace(/\s+/g, " ").trim() : null,
  };
};

async function serveKC(page) {
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "kc.local") return r.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html")) return r.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(KC_ROOT, "index.html")) });
    const f = join(KC_ROOT, normalize(p).replace(/^([/\\])+/, ""));
    if (f.startsWith(KC_ROOT) && existsSync(f) && statSync(f).isFile()) return r.fulfill({ status: 200, contentType: MIME[extname(f)] || "application/octet-stream", body: readFileSync(f) });
    return r.fulfill({ status: 404, body: "" });
  });
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const rows = {};
for (const w of [360, 375, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const apollo = await serveApollOs(page, w);
  await serveKC(page);
  await page.goto("http://kc.local/#/products", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  rows[w] = {
    apollo: await page.evaluate(apolloProbe),
    kc: await page.evaluate(kcProbe),
  };
  console.log(w, JSON.stringify({ apollo: rows[w].apollo, kc: rows[w].kc.kcCard }));
  await ctx.close();
}
await browser.close();

function serveApollOs(page, w) {
  return page.goto("https://www.apollopharmacy.in/shop-by-category/night-cream", { waitUntil: "domcontentloaded", timeout: 45000 }).then(() => page.waitForTimeout(5000));
}
