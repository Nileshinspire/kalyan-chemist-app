// Test 32 — MOBILE REGRESSION TEST (offline).
//
// Checks the customer routes at the required phone widths (320 / 390 / 430 by
// default) and FAILS (exit 1) on any regression in:
//   1. horizontal page overflow           (documentElement.scrollWidth > clientWidth)
//   2. elements painted outside the viewport
//   3. clipped text                       (overflow:hidden with no ellipsis/clamp)
//   4. broken images
//   5. homepage section-rhythm regressions (heading scale/offset/alignment and
//      mobile carousel geometry — the guarantees normalised in the
//      "mobile section rhythm + carousel behaviour" pass)
//   6. content hidden behind the fixed bottom navigation at full scroll
//
// Why offline: qa/t31-responsive-widths.mjs asserts against the live preview.
// This one serves ./dist over an in-page route so the same checks can run when
// the preview is unavailable (no server process, no network).
//
// Run:  node qa/t32-mobile-regression.mjs            # 320,390,430 on ./dist
//       W=320,390 node qa/t32-mobile-regression.mjs  # a subset of widths
//       BASE=<url> node qa/t32-mobile-regression.mjs # audit a deployment instead
//
// Exit codes: 0 = pass · 1 = regression · 78 = build/preview unavailable
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const DIST = join(process.cwd(), "dist");
const REMOTE = process.env.BASE || null;
if (!REMOTE && !existsSync(join(DIST, "index.html"))) {
  console.error("[ENVIRONMENT BLOCKED] dist/index.html missing — run `bun run build` first.");
  process.exit(78);
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg",
};

const WIDTHS = (process.env.W || "320,390,430").split(",").map(Number).filter(Boolean);
const ORIGIN = REMOTE || "http://kc.local";

const ROUTES = [
  ["#/", "Home"],
  ["#/products", "Products"],
  ["#/categories", "Categories"],
  ["#/cart", "Cart"],
  ["#/hot-sellers", "Hot sellers"],
  ["#/value-deals", "Value deals"],
  ["#/doctor-appointment", "Doctors"],
  ["#/about-us", "About"],
  ["#/contact-us", "Contact"],
  ["#/faqs", "FAQs"],
  ["#/sitemap", "Sitemap"],
  ["#/brands", "Brands"],
];

/* ── In-page assertions (run inside the browser) ───────────────────────── */
const checks = () => {
  const vw = document.documentElement.clientWidth;
  const out = {
    vw,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: [],
    clipped: [],
    brokenImages: [],
    hiddenBehindBar: 0,
  };

  const inScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowX;
      if (/(auto|scroll|hidden|clip)/.test(o) && p.scrollWidth > p.clientWidth + 1) return true;
      p = p.parentElement;
    }
    return false;
  };

  // 1 + 2 — anything painted past the viewport that is not inside a horizontal
  // scroller, is not fixed chrome, and is not clipped by an ancestor.
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (cs.position === "absolute" && /blur-3xl|rounded-full/.test(String(el.className))) continue;
    if (r.right > vw + 2 || r.left < -2) {
      if (inScroller(el)) continue;
      let p = el.parentElement, clippedBy = false;
      while (p && p !== document.body) {
        const o = getComputedStyle(p).overflowX;
        if (/(hidden|clip)/.test(o)) { clippedBy = true; break; }
        p = p.parentElement;
      }
      if (clippedBy) continue;
      out.overflow.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 60),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
    if (out.overflow.length >= 6) break;
  }

  // 3 — text genuinely cut off (no ellipsis, no line-clamp to soften it).
  for (const el of document.querySelectorAll("body h1, body h2, body h3, body p, body a, body button, body li, body span")) {
    if (out.clipped.length >= 6) break;
    const cs = getComputedStyle(el);
    if (cs.overflowX !== "hidden" && cs.overflowX !== "clip") continue;
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 8) continue;
    if (el.scrollWidth <= el.clientWidth + 4) continue;
    if (cs.textOverflow === "ellipsis") continue;          // intentional truncation
    if (/line-clamp|truncate|break-words/.test(String(el.className))) continue;
    if (inScroller(el)) continue;
    out.clipped.push({
      tag: el.tagName.toLowerCase(),
      txt: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 44),
      over: el.scrollWidth - el.clientWidth,
    });
  }

  // 4 — broken images (only ones that finished loading without a source).
  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0 && !/pngtree|wikimedia|placeholder/i.test(img.src)) {
      out.brokenImages.push((img.currentSrc || img.src).slice(-70));
    }
  }

  // 6 — anything in the last screenful that the fixed bottom nav would cover.
  const nav = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed");
  if (nav) {
    const nb = nav.getBoundingClientRect();
    const cover = window.innerHeight - nb.top;
    const pageH = document.body.scrollHeight;
    for (const el of document.querySelectorAll("footer a, footer button")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height < 8) continue;
      // Collapsed accordion panels keep a zero-height box with visibility:hidden;
      // their children overflow an invisible track. Not reachable, not covered.
      if (getComputedStyle(el).visibility !== "visible") continue;
      if (r.bottom + window.scrollY > pageH - cover) { out.hiddenBehindBar++; break; }
    }
  }
  return out;
};

/** Homepage-only: heading rhythm + carousel geometry. */
const rhythm = () => {
  const TARGET = /^(Browse by Health Conditions|Popular Lab Tests|Healthcare Devices|New Arrivals|Value Deals|Your order, from cart|Find What You Need|Hot Sellers|What Our Customers Say|Shop By Brand)/;
  const headings = [];
  for (const h of document.querySelectorAll("h1, h2, h3")) {
    const t = (h.innerText || "").replace(/\s+/g, " ").trim();
    if (!TARGET.test(t)) continue;
    const sec = h.closest("section");
    if (!sec) continue;
    headings.push({
      txt: t,
      fs: Math.round(parseFloat(getComputedStyle(h).fontSize)),
      hd: Math.round(h.getBoundingClientRect().top - sec.getBoundingClientRect().top),
      x: Math.round(h.getBoundingClientRect().left),
    });
  }
  const rails = [];
  for (const d of document.querySelectorAll("div")) {
    const cs = getComputedStyle(d);
    if (cs.overflowX !== "auto") continue;
    if (d.scrollWidth <= d.clientWidth + 20 || d.clientHeight < 80) continue;
    if (/hiw-rail/.test(d.className)) continue;
    const r = d.getBoundingClientRect();
    rails.push({
      left: Math.round(r.left),
      right: Math.round(r.right),
      w: d.clientWidth,
      gap: cs.columnGap,
      card: d.firstElementChild ? Math.round(d.firstElementChild.getBoundingClientRect().width) : 0,
    });
  }
  return { headings, rails };
};

/* ── Runner ────────────────────────────────────────────────────────────── */
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const failures = [];
const fail = (m) => { failures.push(m); console.log("  ✗ " + m); };

/** Full top-to-bottom pass so every whileInView reveal has fired before we measure. */
const settle = async (page) => {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.7);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 900));
  });
};

for (const w of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();
  if (!REMOTE) {
    await page.route("**/*", async (ro) => {
      const u = new URL(ro.request().url());
      if (u.hostname !== "kc.local") return ro.continue();
      const p = decodeURIComponent(u.pathname);
      if (p === "/" || p.endsWith(".html")) return ro.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(DIST, "index.html")) });
      const rel = normalize(p).replace(/^([/\\])+/, "");
      const file = join(DIST, rel);
      if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) return ro.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
      return ro.fulfill({ status: 404, body: "nf" });
    });
  }
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));

  console.log(`\n══ ${w}px ${"═".repeat(40)}`);

  for (const [route, label] of ROUTES) {
    await page.goto(`${ORIGIN}/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3200);
    await settle(page);
    const r = await page.evaluate(checks);
    if (r.scrollWidth > r.vw + 1) fail(`[${w}] ${label}: horizontal overflow scrollW=${r.scrollWidth} vw=${r.vw}`);
    if (r.overflow.length) fail(`[${w}] ${label}: elements outside viewport ${JSON.stringify(r.overflow)}`);
    if (r.clipped.length) fail(`[${w}] ${label}: clipped text ${JSON.stringify(r.clipped)}`);
    if (r.brokenImages.length) fail(`[${w}] ${label}: broken images ${JSON.stringify(r.brokenImages)}`);
    if (r.hiddenBehindBar) fail(`[${w}] ${label}: ${r.hiddenBehindBar} footer link(s) behind the bottom nav`);
    if (pageErrors.length) fail(`[${w}] ${label}: page errors ${JSON.stringify(pageErrors.slice(0, 2))}`);
    console.log(`  ${r.clipped.length || r.overflow.length ? "✗" : "✓"} ${label} (scrollW=${r.scrollWidth})`);
  }

  // Product detail — a real product discovered at runtime.
  await page.goto(`${ORIGIN}/#/products`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3200);
  const firstCard = page.locator(".kc-products-grid > *").first();
  try {
    await firstCard.click({ timeout: 8000 });
    await page.waitForTimeout(2600);
    await settle(page);
    const d = await page.evaluate(checks);
    if (d.scrollWidth > d.vw + 1) fail(`[${w}] Product detail: horizontal overflow scrollW=${d.scrollWidth}`);
    if (d.overflow.length) fail(`[${w}] Product detail: elements outside viewport ${JSON.stringify(d.overflow)}`);
    if (d.clipped.length) fail(`[${w}] Product detail: clipped text ${JSON.stringify(d.clipped)}`);
    console.log(`  ${d.clipped.length || d.overflow.length ? "✗" : "✓"} Product detail (scrollW=${d.scrollWidth})`);
  } catch (e) {
    fail(`[${w}] Product detail: could not open a product (${String(e).slice(0, 80)})`);
  }

  // Homepage rhythm + carousel geometry (this task's guarantees).
  await page.goto(`${ORIGIN}/#/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3600);
  await settle(page);
  await page.waitForTimeout(1200);
  const h = await page.evaluate(rhythm);
  const expected = 10;
  if (h.headings.length < expected) fail(`[${w}] Home: only ${h.headings.length} section headings measured (expected ${expected})`);
  for (const t of h.headings) {
    if (t.fs < 23 || t.fs > 25) fail(`[${w}] Home: "${t.txt}" heading is ${t.fs}px (expected 24px)`);
    if (t.hd < 60 || t.hd > 70) fail(`[${w}] Home: "${t.txt}" sits ${t.hd}px below its section (expected 60-70px)`);
    if (t.x !== 16) fail(`[${w}] Home: "${t.txt}" starts at x=${t.x} (expected 16)`);
  }
  if (h.rails.length >= 4) {
    const [first, ...rest] = h.rails;
    for (const r of rest) {
      if (r.left !== first.left || r.right !== first.right || r.w !== first.w)
        fail(`[${w}] Home: carousel spans ${r.left}->${r.right} (w=${r.w}) vs ${first.left}->${first.right} (w=${first.w})`);
      if (r.gap !== first.gap)
        fail(`[${w}] Home: carousel gap ${r.gap} vs ${first.gap}`);
    }
    console.log(`  ✓ Home headings=${h.headings.length} rails=${h.rails.length} span=${first.left}->${first.right} gap=${first.gap}`);
  } else {
    fail(`[${w}] Home: only ${h.rails.length} carousels measured (expected >= 4)`);
  }

  await ctx.close();
}

await browser.close();

console.log(`\n${failures.length ? "FAILURES:" : "ALL MOBILE REGRESSION CHECKS PASSED"}`);
for (const f of failures) console.log(" - " + f);
console.log(`checked widths: ${WIDTHS.join(", ")} · routes: ${ROUTES.length} + product detail + homepage rhythm`);
process.exit(failures.length ? 1 : 0);
