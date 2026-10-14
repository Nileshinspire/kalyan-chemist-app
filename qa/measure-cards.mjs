// Measure product-card geometry (card / image band / image / text / buttons)
// across viewports from a built bundle served locally.
// Usage: KC_ROOT=dist-before node qa/measure-cards.mjs [tag]
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = join(process.cwd(), process.env.KC_ROOT || "dist-verify");
const TAG = process.argv[2] || process.env.KC_TAG || "cur";
const SHOTS = join(process.cwd(), "qa/shots");
mkdirSync(SHOTS, { recursive: true });
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

async function serve(page) {
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "kc.local") return r.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html"))
      return r.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(ROOT, "index.html")) });
    const f = join(ROOT, normalize(p).replace(/^([/\\])+/, ""));
    if (f.startsWith(ROOT) && existsSync(f) && statSync(f).isFile())
      return r.fulfill({ status: 200, contentType: MIME[extname(f)] || "application/octet-stream", body: readFileSync(f) });
    return r.fulfill({ status: 404, body: "" });
  });
}

const PROBE = () => {
  const B = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const imgInfo = (img) => {
    const b = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    return {
      ...B(img),
      fit: cs.objectFit,
      natural: `${img.naturalWidth}x${img.naturalHeight}`,
      naturalAspect: img.naturalHeight ? +(img.naturalWidth / img.naturalHeight).toFixed(2) : null,
      visibleW: Math.round(b.width),
      visibleH: Math.round(b.height),
      src: (img.getAttribute("src") || "").slice(-48),
    };
  };

  const cards = [...document.querySelectorAll('[data-slot="card"]')].filter((c) =>
    /buy now|cart|out of stock/i.test(c.textContent || "")
  );

  const bySection = new Map();
  for (const card of cards) {
    const sec = card.closest("section");
    const head = sec?.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 30) || "?";
    const band = card.querySelector('div[class*="h-24"], div[class*="h-28"], div[class*="h-32"], div[class*="h-40"], div[class*="h-44"]');
    const img = card.querySelector("img");
    const buttons = [...card.querySelectorAll("button")].map((b) => ({ l: (b.textContent || "").trim().slice(0, 12), ...B(b) }));
    const texts = [...card.querySelectorAll("h3, p, span")].slice(0, 8).map((el) => ({
      t: (el.textContent || "").trim().slice(0, 26), ...B(el),
    }));
    const entry = {
      head,
      name: (card.querySelector("h3")?.textContent || "").trim().slice(0, 22),
      card: B(card),
      band: band ? B(band) : null,
      img: img ? imgInfo(img) : null,
      buttons,
      texts,
      overflowX: card.scrollWidth > card.clientWidth + 1,
    };
    if (!bySection.has(head)) bySection.set(head, []);
    bySection.get(head).push(entry);
  }

  return {
    vw: document.documentElement.clientWidth,
    scrollW: document.documentElement.scrollWidth,
    sections: [...bySection.entries()].map(([head, list]) => ({
      head,
      n: list.length,
      sample: list.slice(0, 4),
      distinctCardW: [...new Set(list.map((e) => e.card.w))],
      distinctCardH: [...new Set(list.map((e) => e.card.h))],
    })),
  };
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const WIDTHS = [360, 375, 390, 430, 1440];
const out = {};
for (const w of WIDTHS) {
  const mobile = w < 700;
  const ctx = await browser.newContext({
    viewport: { width: w, height: mobile ? 844 : 900 },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await serve(page);
  await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.9);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
  });
  out[w] = await page.evaluate(PROBE);
  await page.screenshot({ path: join(SHOTS, `${TAG}-home-${w}.png`), fullPage: false });

  for (const [key, route] of [
    ["products", "#/products"],
    ["hot-sellers", "#/hot-sellers"],
    ["value-deals", "#/value-deals"],
  ]) {
    await page.goto(`http://kc.local/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.evaluate(async () => {
      const step = Math.round(innerHeight * 0.9);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
    out[`${w}-${key}`] = await page.evaluate(PROBE);
    if (key === "products") await page.screenshot({ path: join(SHOTS, `${TAG}-products-${w}.png`) });
    if (key === "hot-sellers" && w === 390) await page.screenshot({ path: join(SHOTS, `${TAG}-hot-sellers-${w}.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
