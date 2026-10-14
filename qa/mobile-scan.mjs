// Mobile defect scanner: walks customer routes at phone widths and reports the
// concrete layout problems the user cares about (cramped grids, clipped text,
// tiny tap targets, zero-rhythm sections, real horizontal overflow inside
// non-scrollable containers, content hidden behind the fixed bottom bar).
//
// Usage: node qa/mobile-scan.mjs [route1,route2,...]
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const DIST = join(process.cwd(), "dist");
const REMOTE = process.env.BASE || null;
if (!REMOTE && !existsSync(join(DIST, "index.html"))) {
  console.error("dist/index.html missing");
  process.exit(78);
}
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg",
};

const ROUTES = (process.argv[2] || "#/,#/products,#/categories,#/cart,#/lab-tests,#/doctor-appointment,#/upload-prescription,#/refill,#/chatbot,#/value-deals,#/hot-sellers,#/about-us,#/contact-us,#/faqs,#/sitemap").split(",");

const WIDTHS = (process.env.WIDTHS || "320,390,430").split(",").map(Number);

function analyze() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const issues = { overflow: null, cramped: [], clipped: [], tinyTap: [], noPad: [], covered: [], distorted: [], floating: [] };
  const de = document.documentElement;
  issues.overflow = de.scrollWidth > vw + 1 ? { sw: de.scrollWidth, vw } : null;

  const inScroller = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if ((cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.overflowX === "hidden") && p.scrollWidth > p.clientWidth + 1) return true;
      p = p.parentElement;
    }
    return false;
  };

  // real overflow offenders (not inside horizontal rails)
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 && !inScroller(el)) {
      issues.cramped.push({ t: "ovf", tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), right: Math.round(r.right), w: Math.round(r.width) });
      if (issues.cramped.length > 12) break;
    }
  }

  // grids with very narrow cells on phones (skip nav bars / toggles)
  for (const g of document.querySelectorAll('[class*="grid"]')) {
    const cs = getComputedStyle(g);
    if (!cs.display.includes("grid")) continue;
    if (g.closest("nav")) continue;
    const cols = cs.gridTemplateColumns.split(" ").filter(Boolean).length;
    if (cols < 2) continue;
    const r = g.getBoundingClientRect();
    if (r.width < 200 || r.height < 30) continue;
    const gap = parseFloat(cs.columnGap) || 0;
    const cell = (r.width - gap * (cols - 1)) / cols;
    if (cell < 138) issues.cramped.push({ t: "grid", cls: String(g.className).slice(0, 60), cols, cell: Math.round(cell), w: Math.round(r.width) });
    if (issues.cramped.length > 24) break;
  }

  // clipped single-line text
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length > 0) continue;
    const txt = (el.textContent || "").trim();
    if (txt.length < 4) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 6) continue;
    if (cs.overflow === "hidden" && cs.whiteSpace === "nowrap" && el.scrollWidth > el.clientWidth + 2 && !cs.textOverflow.includes("ellipsis")) {
      issues.clipped.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), txt: txt.slice(0, 34) });
      if (issues.clipped.length > 10) break;
    }
  }

  // small tap targets (interactive, visible, standalone)
  for (const el of document.querySelectorAll("a[href], button, [role=button], input, select")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    // skip anything inside a horizontal scroller or a text link in prose
    if (r.height < 32 && r.width < 32 && !inScroller(el)) {
      issues.tinyTap.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 44), w: Math.round(r.width), h: Math.round(r.height), txt: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24) });
      if (issues.tinyTap.length > 10) break;
    }
  }

  // text that visually overflows its own box (real clipping, any white-space)
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length > 0) continue;
    const txt = (el.textContent || "").trim();
    if (txt.length < 5) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX !== "hidden" && cs.overflowX !== "clip") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 8) continue;
    if (el.scrollWidth > el.clientWidth + 2 && !inScroller(el)) {
      issues.clipped.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 50), txt: txt.slice(0, 34), over: el.scrollWidth - el.clientWidth });
      if (issues.clipped.length > 10) break;
    }
  }

  // top-level sections with no mobile vertical padding
  for (const el of document.querySelectorAll("section, footer")) {
    const r = el.getBoundingClientRect();
    if (r.height < 120 || r.width < 200) continue;
    const cs = getComputedStyle(el);
    const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    // look at the first inner container too
    const inner = el.querySelector(":scope > div");
    const ics = inner ? getComputedStyle(inner) : null;
    const ipt = ics ? parseFloat(ics.paddingTop) : 0;
    const ipb = ics ? parseFloat(ics.paddingBottom) : 0;
    if (pt + ipt < 8 && pb + ipb < 8) {
      const h = el.querySelector("h1,h2");
      issues.noPad.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 46), pad: `${pt}/${pb} inner ${ipt}/${ipb}`, head: h ? h.textContent.trim().slice(0, 30) : "" });
    }
  }

  // content hidden behind the fixed bottom bar
  const fixedBars = [...document.querySelectorAll("body *")].filter((e) => {
    const cs = getComputedStyle(e);
    if (cs.position !== "fixed") return false;
    const r = e.getBoundingClientRect();
    return r.height > 30 && r.bottom > vh - 130 && r.left < vw * 0.4;
  });
  if (fixedBars.length) {
    const barTop = Math.min(...fixedBars.map((e) => e.getBoundingClientRect().top));
    for (const el of document.querySelectorAll("footer a, footer button, main a")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height < 8) continue;
      if (getComputedStyle(el).visibility !== "visible") continue;
      const docTop = r.top + window.scrollY;
      const docBottom = r.bottom + window.scrollY;
      const pageH = document.body.scrollHeight;
      // element already positioned under the bar when scrolled to the very bottom
      if (docBottom > pageH - (vh - barTop)) {
        issues.covered.push({ tag: el.tagName.toLowerCase(), txt: (el.textContent || "").trim().slice(0, 24) });
        if (issues.covered.length > 6) break;
      }
    }
  }

  // distorted images
  for (const img of document.querySelectorAll("img")) {
    if (!img.naturalWidth) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) continue;
    const cs = getComputedStyle(img);
    if (cs.objectFit === "cover" || cs.objectFit === "fill") continue;
    const nat = img.naturalWidth / img.naturalHeight;
    const rend = r.width / r.height;
    if (Math.abs(rend - nat) / nat > 0.08) issues.distorted.push({ src: (img.currentSrc || img.src).slice(-46), nat: +nat.toFixed(2), rend: +rend.toFixed(2) });
    if (issues.distorted.length > 8) break;
  }

  issues.pageH = Math.round(document.body.scrollHeight);
  issues.sections = [];
  const walk = (el, d) => {
    for (const c of el.children) {
      if (c.tagName === "SECTION" || c.tagName === "FOOTER") {
        const r = c.getBoundingClientRect();
        if (r.height < 60) continue;
        const h = c.querySelector("h1,h2");
        const cs = getComputedStyle(c);
        const inner = c.querySelector(":scope > div");
        const ics = inner ? getComputedStyle(inner) : null;
        issues.sections.push({
          top: Math.round(r.top + window.scrollY), h: Math.round(r.height),
          pt: Math.round(parseFloat(cs.paddingTop) + (ics ? parseFloat(ics.paddingTop) : 0)),
          pb: Math.round(parseFloat(cs.paddingBottom) + (ics ? parseFloat(ics.paddingBottom) : 0)),
          head: h ? h.textContent.replace(/\s+/g, " ").trim().slice(0, 28) : "",
        });
      } else if (d < 7) walk(c, d + 1);
    }
  };
  walk(document.body, 0);
  return issues;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const route of ROUTES) {
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
        let p = decodeURIComponent(u.pathname);
        if (p === "/" || p.endsWith(".html")) return ro.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(DIST, "index.html")) });
        const rel = normalize(p).replace(/^([/\\])+/, "");
        const file = join(DIST, rel);
        if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) return ro.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
        return ro.fulfill({ status: 404, body: "nf" });
      });
    }
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    try {
      await page.goto(REMOTE ? `${REMOTE}/${route}` : `http://kc.local/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3500);
      await page.evaluate(async () => {
        const step = Math.round(window.innerHeight * 0.9);
        for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 70)); }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 400));
      });
      const res = await page.evaluate(analyze);
      const key = `${route}@${w}`;
      const flags = [];
      if (res.overflow) flags.push(`OVERFLOW sw=${res.overflow.sw}`);
      if (res.cramped.length) flags.push(`cramped:${res.cramped.length}`);
      if (res.clipped.length) flags.push(`clipped:${res.clipped.length}`);
      if (res.tinyTap.length) flags.push(`tinyTap:${res.tinyTap.length}`);
      if (res.noPad.length) flags.push(`noPad:${res.noPad.length}`);
      if (res.covered.length) flags.push(`covered:${res.covered.length}`);
      if (res.distorted.length) flags.push(`distorted:${res.distorted.length}`);
      if (errs.length) flags.push(`errors:${errs.length}`);
      console.log(`\n### ${key} h=${res.pageH} ${flags.join(" ") || "clean"}`);
      if (res.cramped.length) console.log("  cramped:", JSON.stringify(res.cramped.slice(0, 10)));
      if (res.clipped.length) console.log("  clipped:", JSON.stringify(res.clipped.slice(0, 6)));
      if (res.tinyTap.length) console.log("  tinyTap:", JSON.stringify(res.tinyTap.slice(0, 6)));
      if (res.noPad.length) console.log("  noPad:", JSON.stringify(res.noPad.slice(0, 6)));
      if (res.covered.length) console.log("  covered:", JSON.stringify(res.covered.slice(0, 6)));
      if (res.distorted.length) console.log("  distorted:", JSON.stringify(res.distorted.slice(0, 6)));
      if (errs.length) console.log("  errors:", JSON.stringify(errs.slice(0, 3)));
      if (process.env.SHOW_SECTIONS) console.log("  sections:", JSON.stringify(res.sections));
    } catch (e) {
      console.log(`\n### ${route}@${w} FAILED ${String(e).slice(0, 160)}`);
    }
    await ctx.close();
  }
}
await browser.close();
