// Verify the Apollo-style mobile homepage geometry on the local build.
// Run: node qa/kc-mobile-geometry.mjs
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const DIST = join(process.cwd(), "dist");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failures++;
};

async function open(width) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "kc.local") return r.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html")) {
      return r.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(DIST, "index.html")) });
    }
    const file = join(DIST, normalize(p).replace(/^([/\\])+/, ""));
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
      return r.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
    }
    return r.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.9);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
  });
  return { ctx, page, pageErrors };
}

for (const width of [390, 320]) {
  console.log(`\n──── viewport ${width}px ────`);
  const { ctx, page, pageErrors } = await open(width);
  const data = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top + window.scrollY) };
    };
    const out = { vw, scrollW: document.documentElement.scrollWidth };

    // header
    const hdr = document.querySelector("header");
    out.headerH = hdr ? Math.round(hdr.getBoundingClientRect().height) : 0;

    // quick-action rail: the button container inside the section right after the hero
    const hero = document.querySelector("h1");
    const heroSection = hero?.closest("section");
    const quickSection = heroSection?.nextElementSibling;
    const quickWrap = quickSection?.querySelector("div > div");
    if (quickWrap) {
      const style = getComputedStyle(quickWrap);
      out.quick = {
        display: style.display,
        overflowX: style.overflowX,
        cards: [...quickWrap.children].slice(0, 5).map((c) => box(c)),
      };
    }

    // health conditions: the grid under "Browse by Health Conditions"
    const condH = [...document.querySelectorAll("h2")].find((h) => /browse by health conditions/i.test(h.textContent || ""));
    const condGrid = condH?.parentElement?.parentElement?.querySelector('[class*="grid"]');
    if (condGrid) {
      const cs = getComputedStyle(condGrid);
      out.cond = {
        cols: cs.gridTemplateColumns.split(" ").length,
        tiles: [...condGrid.children].slice(0, 6).map((t) => box(t)),
        label: (() => {
          const l = condGrid.querySelector("span[class*='mt-']");
          return l ? { fs: getComputedStyle(l).fontSize, ...box(l) } : null;
        })(),
      };
    }

    // product rails: widths of the cards in each swipeable track.
    // The quick-action rail (fixed 104px service cards) is excluded so the
    // product-carousel checks only measure the commerce carousels.
    out.rails = [...document.querySelectorAll('[class*="snap-x"]')]
      .map((rail) => {
        const r = rail.getBoundingClientRect();
        if (r.width < 50) return null;
        if (String(rail.firstElementChild?.className || "").includes("w-[104px]")) return null;
        const cards = [...rail.children].map((c) => c.getBoundingClientRect().width).filter((w) => w > 40);
        if (!cards.length) return null;
        const cs = getComputedStyle(rail);
        return { y: Math.round(r.top + window.scrollY), gap: cs.gap, cardW: Math.round(cards[0]), n: cards.length };
      })
      .filter(Boolean)
      .slice(0, 8);

    // hot sellers: real packshot rendered on mobile?
    const hotH = [...document.querySelectorAll("h2")].find((h) => /hot sellers/i.test(h.textContent || ""));
    if (hotH) {
      const sec = hotH.closest("section");
      const imgs = [...(sec?.querySelectorAll("img") || [])];
      out.hotImgs = imgs.filter((i) => i.getBoundingClientRect().width > 40).length;
      out.hotVisiblePills = [...(sec?.querySelectorAll("svg.lucide-pill") || [])].filter((p) => p.getBoundingClientRect().width > 0).length;
    }

    // page-level overflow + section gap rhythm
    out.overflow = out.scrollW > vw + 1;
    return out;
  });

  check(`W=${width}: no page horizontal overflow`, !data.overflow, `scrollW=${data.scrollW}`);
  check(`W=${width}: header compact at top (max 150px)`, data.headerH > 40 && data.headerH <= 150, `h=${data.headerH}`);
  if (data.quick) {
    const cw = data.quick.cards.map((c) => c.w);
    check(`W=${width}: quick actions are a swipeable card rail`, data.quick.display === "flex" && /auto/.test(data.quick.overflowX), `display=${data.quick.display}`);
    check(`W=${width}: quick cards ~100-120px wide, ≥3 visible`, cw.every((w) => w >= 90 && w <= 125) && cw.length === 5, JSON.stringify(cw));
  } else check(`W=${width}: quick action rail found`, false);
  if (data.cond) {
    check(`W=${width}: health conditions use a 5-column compact grid`, data.cond.cols === 5, `cols=${data.cond.cols}`);
    const tw = data.cond.tiles.map((t) => t.w);
    check(`W=${width}: condition tiles ≤ 80px wide`, tw.every((w) => w <= 80), JSON.stringify(tw.slice(0, 3)));
    check(`W=${width}: condition labels max 12px`, data.cond.label && parseFloat(data.cond.label.fs) <= 12.5, data.cond.label?.fs);
  } else check(`W=${width}: health conditions grid found`, false);
  if (data.rails.length) {
    // Apollo cards scale with viewport: ~162px at 390, ~130px at 320.
    const peek = data.rails.filter((r) => r.cardW >= 110 && r.cardW <= 185);
    check(`W=${width}: product carousel cards 110-185px (Apollo peek)`, peek.length >= 3, JSON.stringify(data.rails.map((r) => r.cardW)));
    const gaps = [...new Set(data.rails.map((r) => r.gap))];
    check(`W=${width}: carousel gaps 12px`, gaps.every((g) => g === "12px"), JSON.stringify(gaps));
  } else check(`W=${width}: product carousels found`, false);
  check(`W=${width}: Hot Sellers shows real product images on mobile`, (data.hotImgs ?? 0) >= 1, `imgs=${data.hotImgs} visiblePills=${data.hotVisiblePills}`);
  check(`W=${width}: no page errors`, pageErrors.length === 0, JSON.stringify(pageErrors));
  await ctx.close();
}

// ── Mobile menu sheet must carry the five service links (they moved out of
// the phone sticky header, so their menu-sheet mirror is the reachability
// guarantee that nothing was removed).
{
  console.log("\n──── mobile menu sheet ────");
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "kc.local") return r.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html")) {
      return r.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(DIST, "index.html")) });
    }
    const file = join(DIST, normalize(p).replace(/^([/\\])+/, ""));
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
      return r.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
    }
    return r.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  // The menu trigger is the ghost icon button carrying the Menu icon in the header.
  const menuBtn = page.locator("header button:has(svg.lucide-menu)").first();
  await menuBtn.click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await page.waitForTimeout(800);
  const sheetText = await page.evaluate(() => (document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]')?.textContent || ""));
  const services = ["Upload Prescription", "Doctor Appointment", "Lab Tests", "Medicine Refill", "AI Chatbot"];
  const missing = services.filter((s) => !sheetText.includes(s));
  check("menu sheet lists all 5 service links", missing.length === 0, missing.length ? `missing=${JSON.stringify(missing)}` : "");
  check("menu sheet still lists categories", /Categories/.test(sheetText) && /Baby Care/.test(sheetText));
  // navigate via a service link
  const labLink = page.getByRole("button", { name: "Lab Tests" }).first();
  if (await labLink.isVisible().catch(() => false)) {
    await labLink.click();
    await page.waitForTimeout(1200);
    const url = page.url();
    check("service link navigates to /lab-tests", url.includes("lab-tests"), url);
  } else check("service link navigates to /lab-tests", false, "link not visible");
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nALL MOBILE GEOMETRY CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
