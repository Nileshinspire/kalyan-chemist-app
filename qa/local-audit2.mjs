// Local layout audit (post-fix), mirrors qa/local-audit.mjs but reads the
// already-built dist/ and reports the same layout signals at multiple widths.
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const route = process.argv[2] || "#/";
const widths = (process.argv[3] || "375,1440")
  .split(",")
  .map((n) => parseInt(n, 10))
  .filter(Number.isFinite);
const label = process.argv[4] || "postfix";
const outFile = process.argv[5];
const DIST = join(process.cwd(), "dist");

if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/index.html missing — run `bun run build` first");
  process.exit(78);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

function analyze() {
  const vw = document.documentElement.clientWidth;
  const de = document.documentElement;
  const out = {
    vw,
    scrollWidth: de.scrollWidth,
    overflow: de.scrollWidth > vw + 1,
    bodyHeight: Math.round(document.body.scrollHeight),
  };

  const landmarks = [];
  for (const el of document.querySelectorAll("section, .section, .landing-section, [class*='section']")) {
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) continue;
    const cs = getComputedStyle(el);
    landmarks.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 48),
      left: Math.round(r.left),
      right: Math.round(r.right),
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      mx: cs.marginLeft,
      my: cs.marginTop + cs.marginBottom,
      py: cs.paddingTop + cs.paddingBottom,
      overflowX: cs.overflowX,
      innerLeft: Math.round(r.left + r.width / 2),
    });
    if (landmarks.length > 22) break;
  }
  out.landmarks = landmarks;

  const fixed = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).position !== "fixed") continue;
    fixed.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 54),
      pos: getComputedStyle(el).position,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      h: Math.round(r.height),
      z: getComputedStyle(el).zIndex,
    });
    if (fixed.length > 25) break;
  }
  out.fixed = fixed;

  out.grids = [];
  for (const g of document.querySelectorAll('[class*="grid"]')) {
    const cs = getComputedStyle(g);
    if (cs.display.indexOf("grid") === -1) continue;
    const cols = cs.gridTemplateColumns;
    if (!cols || cols === "none") continue;
    const n = cols.split(" ").filter(Boolean).length;
    if (n < 2) continue;
    out.grids.push({ cls: String(g.className || "").slice(0, 46), cols: n });
    if (out.grids.length > 14) break;
  }

  out.type = [];
  for (const el of document.querySelectorAll("h1, h2")) {
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 6) continue;
    out.type.push({
      txt: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 36),
      fs: Math.round(parseFloat(getComputedStyle(el).fontSize)),
      w: Math.round(r.width),
      x: Math.round(r.left),
    });
    if (out.type.length > 12) break;
  }

  const distorted = [];
  for (const img of document.querySelectorAll("img")) {
    if (!img.naturalWidth) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) continue;
    const cs = getComputedStyle(img);
    if (cs.objectFit === "cover" || cs.objectFit === "fill") continue;
    const nat = img.naturalWidth / img.naturalHeight;
    const rend = r.width / r.height;
    if (Math.abs(rend - nat) / nat > 0.1) {
      distorted.push({ src: (img.currentSrc || img.src).slice(-50), nat: +nat.toFixed(2), rend: +rend.toFixed(2) });
    }
    if (distorted.length > 10) break;
  }
  out.distortedImages = distorted;

  out.xs = [...new Set(out.landmarks.map((m) => m.innerLeft ?? m.left))];

  out.links = [
    ...new Set(
      [...document.querySelectorAll('a[href*="/products/"]')].map((a) => a.getAttribute("href"))
    ),
  ].slice(0, 6);

  const hdr = document.querySelector("header");
  if (hdr) {
    const hr = hdr.getBoundingClientRect();
    out.header = {
      h: Math.round(hr.height),
      pos: getComputedStyle(hdr).position,
      top: getComputedStyle(hdr).top,
      children: [...hdr.children].map((c) => ({
        tag: c.tagName.toLowerCase(),
        cls: String(c.className || "").slice(0, 44),
        h: Math.round(c.getBoundingClientRect().height),
        disp: getComputedStyle(c).display,
      })),
    };
  }

  return out;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const results = { label, route, widths: {} };

for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: w < 768 ? 844 : 900 },
    isMobile: w < 768,
    hasTouch: w < 768,
    deviceScaleFactor: w < 768 ? 2 : 1,
    userAgent:
      w < 768
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

  await page.route("**/*", async (routeObj) => {
    const reqUrl = new URL(routeObj.request().url());
    if (reqUrl.hostname !== "kc.local") return routeObj.continue();
    let p = decodeURIComponent(reqUrl.pathname);
    if (p === "/" || p.endsWith(".html")) {
      return routeObj.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(DIST, "index.html")) });
    }
    const rel = normalize(p).replace(/^([/\\])+/, "");
    const file = join(DIST, rel);
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
      return routeObj.fulfill({
        status: 200,
        contentType: MIME[extname(file)] || "application/octet-stream",
        body: readFileSync(file),
      });
    }
    return routeObj.fulfill({ status: 404, body: "not found" });
  });

  try {
    await page.goto(`http://kc.local/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.9);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 500));
    });
    results.widths[w] = await page.evaluate(analyze);
    results.widths[w].errors = errs.slice(0, 4);
    results.widths[w].text = (
      await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 220))
    );
  } catch (e) {
    results.widths[w] = { failed: String(e).slice(0, 300), errors: errs.slice(0, 4) };
  }
  await ctx.close();
}

await browser.close();
const json = JSON.stringify(results, null, 2);
if (outFile) writeFileSync(outFile, json);
else console.log(json);
