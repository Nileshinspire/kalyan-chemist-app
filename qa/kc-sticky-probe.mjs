// Sticky-header behaviour probe (Apollo-style compact header while scrolling).
// Run: node qa/kc-sticky-probe.mjs
// Serves ./dist exactly like local-audit (no server process needed).
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const DIST = join(process.cwd(), "dist");
if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/index.html missing");
  process.exit(78);
}
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failures++;
};

async function open(width, hash, isMobile = width < 768) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile,
    hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
  });
  const page = await ctx.newPage();
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "kc.local") return route.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html")) {
      return route.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(DIST, "index.html")) });
    }
    const rel = normalize(p).replace(/^([/\\])+/, "");
    const file = join(DIST, rel);
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
      return route.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.goto(`http://kc.local/${hash}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  return { ctx, page };
}

const measure = (page) =>
  page.evaluate(() => {
    const h = document.querySelector("header");
    if (!h) return null;
    const rows = [...h.children].map((c) => ({
      cls: String(c.className || "").slice(0, 40),
      h: Math.round(c.getBoundingClientRect().height),
      disp: getComputedStyle(c).display,
    }));
    return {
      h: Math.round(h.getBoundingClientRect().height),
      scrolled: h.dataset.kcScrolled,
      home: h.dataset.kcHome,
      rows,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });

// ── Inner page, mobile: top = full rows; scrolled = collapsed ──
{
  const { ctx, page } = await open(390, "#/products");
  const top = await measure(page);
  // New spec: the service-link row is not part of the phone sticky header
  // (Apollo's header carries one nav row), so top = logo + search + category
  // nav = ~142px, and it collapses to ~92px while scrolled.
  check("inner@390 top: header ~142px (logo+search+category nav)", top && top.h >= 130 && top.h <= 152, `h=${top?.h} rows=${JSON.stringify(top?.rows.map((r) => r.h))}`);
  const searchVisibleTop = top.rows.some((r) => r.cls.includes("kc-collapse") && r.disp !== "none");
  check("inner@390 top: search row visible", searchVisibleTop, JSON.stringify(top?.rows));

  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(600);
  const down = await measure(page);
  const searchHidden = down.rows.every((r) => !r.cls.includes("kc-collapse") || r.disp === "none");
  check("inner@390 scrolled: search + service rows collapsed", searchHidden, JSON.stringify(down?.rows));
  check("inner@390 scrolled: header compact (≤100px)", down && down.h <= 100, `h=${down?.h} scrolled=${down?.scrolled}`);
  check("inner@390 scrolled: no page overflow", down && !down.docOverflow);

  // Search still reachable: back to top → row returns
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const back = await measure(page);
  check("inner@390 back-to-top: search row returns", back.h >= 130, `h=${back?.h}`);
  await ctx.close();
}

// ── Homepage, mobile: scrolled keeps the search row (hero owns top search) ──
{
  const { ctx, page } = await open(390, "#/");
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(600);
  const down = await measure(page);
  const searchShown = down.rows.some((r) => r.cls.includes("kc-collapse") && r.disp !== "none");
  check("home@390 scrolled: search row still shown", searchShown, JSON.stringify(down?.rows));
  check(
    "home@390 scrolled: service row absent (no SubNav on home)",
    down.rows.every((r) => !r.cls.startsWith("kc-collapse-on-scroll border-b")),
    JSON.stringify(down?.rows)
  );
  await ctx.close();
}

// ── Desktop inner page: rows must all stay visible at every scroll position ──
{
  const { ctx, page } = await open(1440, "#/products", false);
  const top = await measure(page);
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(600);
  const down = await measure(page);
  check("inner@1440 scrolled: service nav row still visible", down.rows.some((r) => r.cls.includes("kc-collapse") && r.disp !== "none"), JSON.stringify(down.rows));
  check("inner@1440: header height unchanged top vs scrolled", top && down && top.h === down.h, `top=${top?.h} down=${down?.h}`);
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nALL STICKY CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
