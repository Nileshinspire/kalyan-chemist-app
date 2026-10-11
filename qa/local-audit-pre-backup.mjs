// Local layout audit: serves ./dist over an in-browser route (no server process,
// no platform preview) and measures the real rendered layout at several widths.
//
// Usage: node qa/local-audit.mjs <route> <widths> <label> <outFile>
//   e.g.  node qa/local-audit.mjs "#/" "320,375,390,430,768,1024,1440" home /tmp/home.json
import { chromium } from "playwright-core";
import { readFileSync, existsSync, writeFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const route = process.argv[2] || "#/";
const widths = (process.argv[3] || "375,1440")
  .split(",")
  .map((n) => parseInt(n, 10))
  .filter(Number.isFinite);
const label = process.argv[4] || "local";
const outFile = process.argv[5];
const DIST = join(process.cwd(), "dist");
// BASE=<url> audits a live deployment instead of serving ./dist locally.
const REMOTE = process.env.BASE || null;

if (!REMOTE && !existsSync(join(DIST, "index.html"))) {
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

/** Browser-side layout analysis (runs inside the page). */
function analyze() {
  const vw = document.documentElement.clientWidth;
  const de = document.documentElement;
  const out = { vw, scrollWidth: de.scrollWidth, overflow: de.scrollWidth > vw + 1, bodyHeight: 0 };
  out.bodyHeight = Math.round(document.body.scrollHeight);

  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (getComputedStyle(el).position === "fixed") continue;
    if (r.right > vw + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 64),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        txt: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30),
      });
    }
    if (offenders.length > 30) break;
  }
  out.offenders = offenders;

  // landmark bands (header/section/footer) in document order
  const marks = [];
  for (const el of document.querySelectorAll("header, section, footer")) {
    const r = el.getBoundingClientRect();
    if (r.height < 40 || r.width < 40) continue;
    if (r.width > vw + 400) continue;
    const top = Math.round(r.top + window.scrollY);
    const bottom = Math.round(r.bottom + window.scrollY);
    const hEl = el.querySelector("h1, h2");
    const inner = el.querySelector(":scope > div");
    let pad = null,
      innerLeft = null,
      innerW = null;
    if (inner) {
      const ir = inner.getBoundingClientRect();
      const ics = getComputedStyle(inner);
      pad = Math.round(parseFloat(ics.paddingLeft) + parseFloat(ics.paddingRight));
      innerLeft = Math.round(ir.left);
      innerW = Math.round(ir.width);
    }
    // vertical whitespace inside the band: section top → first heading, and
    // last rendered child → section bottom. These are what the eye reads as
    // "space between sections".
    let headDy = null;
    if (hEl) headDy = Math.round(hEl.getBoundingClientRect().top - r.top);
    let tailDy = null;
    for (let i = el.children.length - 1; i >= 0; i--) {
      const c = el.children[i];
      if (c.tagName === "STYLE" || c.tagName === "SCRIPT") continue;
      const cr = c.getBoundingClientRect();
      if (cr.height < 4) continue;
      tailDy = Math.round(r.bottom - cr.bottom);
      break;
    }
    marks.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 46),
      heading: hEl ? (hEl.textContent || "").replace(/\s+/g, " ").trim().slice(0, 44) : "",
      headDy,
      tailDy,
      top,
      bottom,
      h: bottom - top,
      left: Math.round(r.left),
      w: Math.round(r.width),
      pad,
      innerLeft,
      innerW,
      padTop: Math.round(parseFloat(getComputedStyle(el).paddingTop)),
      padBottom: Math.round(parseFloat(getComputedStyle(el).paddingBottom)),
      pos: getComputedStyle(el).position,
    });
  }
  marks.sort((a, b) => a.top - b.top || b.h - a.h);
  const kept = [];
  for (const m of marks) {
    const nested = kept.some(
      (k) => k !== m && k.top <= m.top + 1 && k.bottom >= m.bottom - 1 && !(k.top === m.top && k.h === m.h)
    );
    if (!nested) kept.push(m);
  }
  out.landmarks = kept;
  // space the reader sees between one section's last content and the next
  // section's first heading (or first content if there is no heading).
  out.contentGaps = [];
  for (let i = 1; i < kept.length; i++) {
    const prev = kept[i - 1];
    const cur = kept[i];
    const prevTail = prev.tailDy == null ? 0 : prev.tailDy;
    const curHead = cur.headDy == null ? 0 : cur.headDy;
    out.contentGaps.push({
      gap: prevTail + (cur.top - prev.bottom) + curHead,
      after: prev.heading || prev.cls || prev.tag,
      before: cur.heading || cur.cls || cur.tag,
    });
  }
  out.gaps = [];

  const fixed = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    fixed.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 54),
      pos: cs.position,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      h: Math.round(r.height),
      z: cs.zIndex,
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

  // section left-alignment: every band's inner container should start at the same x
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

  if (!REMOTE) await page.route("**/*", async (routeObj) => {
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
    await page.goto(REMOTE ? `${REMOTE}/${route}` : `http://kc.local/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
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
