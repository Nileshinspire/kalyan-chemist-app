// Layout audit: measures real rendered geometry of a page at several widths.
// Usage:
//   node qa/layout-audit.mjs <url> [widths] [label] [outFile]
//   widths = comma separated, default 320,375,390,430,768,1024,1440
//
// Reports, per width:
//   - horizontal overflow of the document (page sideways scrolling)
//   - every element that sticks out beyond the viewport (clipped content)
//   - top-level section bands (tag, heading text, top/bottom/height, x width)
//   - vertical gaps BETWEEN consecutive bands (negative => overlap)
//   - fixed/sticky elements and whether they cover content
//   - images whose rendered box distorts their natural aspect ratio
import { chromium } from "playwright-core";

const url = process.argv[2];
if (!url) {
  console.error("usage: node qa/layout-audit.mjs <url> [widths] [label] [outFile]");
  process.exit(2);
}
const widths = (process.argv[3] || "320,375,390,430,768,1024,1440")
  .split(",")
  .map((n) => parseInt(n, 10))
  .filter((n) => Number.isFinite(n));
const label = process.argv[4] || "audit";

function analyze(width) {
  const vw = document.documentElement.clientWidth;
  const de = document.documentElement;

  // ── horizontal overflow ──
  const out = { vw, scrollWidth: de.scrollWidth, overflow: de.scrollWidth > vw + 1 };
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed") continue;
    if (r.right > vw + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 70),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
    if (offenders.length > 25) break;
  }
  out.offenders = offenders;

  // ── landmark bands: header / section / footer, sorted by page position ──
  const marks = [];
  for (const el of document.querySelectorAll("header, section, footer")) {
    const r = el.getBoundingClientRect();
    if (r.height < 40 || r.width < 40) continue;
    if (r.width > vw + 400) continue; // skip hidden/offscreen clones
    const top = Math.round(r.top + window.scrollY);
    const bottom = Math.round(r.bottom + window.scrollY);
    const hEl = el.querySelector("h1, h2");
    const cs = getComputedStyle(el);
    // measure the inner container's horizontal padding at this viewport
    const inner = el.querySelector(":scope > div");
    let pad = null, innerLeft = null, innerW = null;
    if (inner) {
      const ir = inner.getBoundingClientRect();
      const ics = getComputedStyle(inner);
      pad = Math.round(parseFloat(ics.paddingLeft) + parseFloat(ics.paddingRight));
      innerLeft = Math.round(ir.left);
      innerW = Math.round(ir.width);
    }
    marks.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 50),
      heading: hEl ? (hEl.textContent || "").trim().slice(0, 46) : "",
      top,
      bottom,
      h: bottom - top,
      left: Math.round(r.left),
      w: Math.round(r.width),
      pad,
      innerLeft,
      innerW,
      padTop: Math.round(parseFloat(cs.paddingTop)),
      padBottom: Math.round(parseFloat(cs.paddingBottom)),
      pos: cs.position,
    });
  }
  marks.sort((a, b) => a.top - b.top || b.h - a.h);
  // drop landmarks fully contained in a parent landmark we already kept
  const kept = [];
  for (const m of marks) {
    const nested = kept.some(
      (k) => k.top <= m.top + 1 && k.bottom >= m.bottom - 1 && k !== m && !(k.top === m.top && k.h === m.h)
    );
    if (!nested) kept.push(m);
  }
  out.landmarks = kept;
  out.landmarkGaps = [];
  for (let i = 1; i < kept.length; i++) {
    const g = kept[i].top - kept[i - 1].bottom;
    if (Math.abs(g) > 6) {
      out.landmarkGaps.push({
        gap: g,
        after: kept[i - 1].heading || kept[i - 1].cls || kept[i - 1].tag,
        before: kept[i].heading || kept[i].cls || kept[i].tag,
      });
    }
  }

  // ── typography: do headings shrink for mobile? ──
  out.typeScale = [];
  for (const el of document.querySelectorAll("h1, h2")) {
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 6) continue;
    const cs = getComputedStyle(el);
    out.typeScale.push({
      tag: el.tagName.toLowerCase(),
      txt: (el.textContent || "").trim().slice(0, 40),
      fs: Math.round(parseFloat(cs.fontSize)),
      lh: Math.round(parseFloat(cs.lineHeight)),
      w: Math.round(r.width),
    });
    if (out.typeScale.length > 14) break;
  }

  // ── product/card grid: how many columns at this width? ──
  out.grids = [];
  for (const g of document.querySelectorAll('[class*="grid"]')) {
    const cs = getComputedStyle(g);
    const cols = cs.gridTemplateColumns;
    if (!cols || cols === "none" || cs.display.indexOf("grid") === -1) continue;
    const n = cols.split(" ").filter(Boolean).length;
    if (n < 2) continue;
    out.grids.push({ cls: String(g.className || "").slice(0, 50), cols: n, template: cols.slice(0, 70) });
    if (out.grids.length > 12) break;
  }

  // ── top-level section bands ──
  // Consider direct children of body/#root and the page's main wrapper sections.
  const bands = [];
  const push = (el, depth) => {
    const r = el.getBoundingClientRect();
    if (r.height < 12 || r.width < 4) return;
    const top = Math.round(r.top + window.scrollY);
    const bottom = Math.round(r.bottom + window.scrollY);
    const h = bottom - top;
    if (h < 8) return;
    let heading = "";
    const hEl = el.querySelector(":scope > h1, :scope > h2, :scope h2");
    if (hEl) heading = (hEl.textContent || "").trim().slice(0, 48);
    bands.push({
      depth,
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 60),
      heading,
      top,
      bottom,
      h,
      left: Math.round(r.left),
      w: Math.round(r.width),
    });
  };

  // depth 0: the page root children (everything after the header)
  const roots = [...document.querySelectorAll("#root > * , #root > * > *")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 8 && el.tagName !== "SCRIPT" && el.tagName !== "STYLE";
  });
  // Walk the deepest common container that holds the sections.
  let container = null;
  const main = document.querySelector("main") || document.querySelector("#root");
  container = main;
  if (container) {
    for (const child of container.children) push(child, 1);
  }
  out.bands = bands;

  // gaps between consecutive bands (only same-depth siblings)
  const gaps = [];
  for (let i = 1; i < bands.length; i++) {
    const prev = bands[i - 1];
    const cur = bands[i];
    const gap = cur.top - prev.bottom;
    if (Math.abs(gap) > 2) gaps.push({ gap, after: prev.heading || prev.cls, before: cur.heading || cur.cls });
  }
  out.gaps = gaps.filter((g) => Math.abs(g.gap) > 8 || g.gap < 0);

  // ── sticky / fixed elements ──
  const fixed = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    fixed.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || "").slice(0, 60),
      pos: cs.position,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      h: Math.round(r.height),
      z: cs.zIndex,
    });
    if (fixed.length > 25) break;
  }
  out.fixed = fixed;

  // ── distorted images ──
  const distorted = [];
  for (const img of document.querySelectorAll("img")) {
    if (!img.naturalWidth) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const natural = img.naturalWidth / img.naturalHeight;
    const rendered = r.width / r.height;
    const cs = getComputedStyle(img);
    if (cs.objectFit !== "cover" && cs.objectFit !== "fill") {
      const dev = Math.abs(rendered - natural) / natural;
      if (dev > 0.08) {
        distorted.push({
          src: (img.currentSrc || img.src).slice(-60),
          natural: +natural.toFixed(2),
          rendered: +rendered.toFixed(2),
          fit: cs.objectFit,
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    if (distorted.length > 15) break;
  }
  out.distortedImages = distorted;

  // ── tap-target audit: tiny interactive elements ──
  const tiny = [];
  for (const el of document.querySelectorAll("a,button,[role=button],input,select")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 30 || r.width < 24) {
      tiny.push({
        tag: el.tagName.toLowerCase(),
        txt: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
    if (tiny.length > 20) break;
  }
  out.tinyTargets = tiny;

  out.bodyHeight = Math.round(document.body.scrollHeight);
  return out;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const results = { label, url, widths: {} };

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
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    // force lazy content in so section bands exist
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.9);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
    results.widths[w] = await page.evaluate(analyze, w);
    results.widths[w].errors = pageErrors.slice(0, 5);
  } catch (e) {
    results.widths[w] = { failed: String(e).slice(0, 300) };
  }
  await ctx.close();
}

await browser.close();

const json = JSON.stringify(results, null, 2);
if (process.argv[5]) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.argv[5], json);
} else {
  console.log(json);
}
