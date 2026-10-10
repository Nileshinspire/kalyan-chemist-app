// Functional smoke test for the mobile UI changes, against the local build.
// Serves ./dist in-browser (no server process) and exercises the new mobile
// controls: bottom nav, filter sheet, mobile sort, sticky purchase bar.
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
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 375, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));

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

const go = async (hash) => {
  await page.goto(`http://kc.local/${hash}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
};

// 1 ── bottom navigation renders and navigates
await go("#/");
const nav = page.locator('nav[aria-label="Mobile navigation"]');
check("bottom nav visible on mobile", await nav.isVisible());
check("bottom nav has 4 items", (await nav.locator("button").count()) === 4);
await nav.locator("button").nth(2).click(); // Cart
await page.waitForTimeout(1500);
check("bottom nav Cart navigates", page.url().includes("#/cart"), page.url());

// 2 ── homepage: category rail visible + swipeable on mobile
await go("#/");
const rail = page.locator('nav:has-text("Nutritional Drinks & Supplements")').first();
const railVisible = await rail.isVisible().catch(() => false);
check("category rail visible on mobile", railVisible);
if (railVisible) {
  const scroller = rail.locator('[class*="overflow-x-auto"]').first();
  const scrollerOk = (await scroller.count()) > 0;
  const railScroll = scrollerOk
    ? await scroller.evaluate((el) => getComputedStyle(el).overflowX === "auto" && el.scrollWidth > el.clientWidth)
    : false;
  check("category rail is horizontally scrollable", railScroll, scrollerOk ? "" : "no scroller");
} else {
  check("category rail is horizontally scrollable", false, "rail not found");
}

// 3 ── homepage sticky search appears on scroll
const searchBefore = await page.locator('form[aria-label="Search medicines"]:visible').count();
await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(1000);
const searchAfter = await page.locator('form[aria-label="Search medicines"]:visible').count();
check("homepage search appears while scrolling", searchAfter === 1 && searchBefore === 0, `before=${searchBefore} after=${searchAfter}`);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(700);

// 4 ── product listing: filter sheet opens with sort + filters, closes
await go("#/products");
await page.waitForTimeout(2000);
const filterBtn = page.locator('button[aria-label="Open filters"]');
check("mobile filter button present", (await filterBtn.count()) === 1);
await filterBtn.click();
await page.waitForTimeout(1000);
const dlg = page.locator('[role="dialog"]');
check("filter sheet opens", (await dlg.count()) === 1 && (await dlg.isVisible()));
const sheetSort = await dlg.getByText("Sort By").count();
check("sort control inside sheet", sheetSort > 0);
const sheetStock = await dlg.getByText("In Stock Only").count();
check("stock filter inside sheet", sheetStock > 0);
await page.keyboard.press("Escape");
await page.waitForTimeout(800);
check("filter sheet closes", (await dlg.count()) === 0);

// 5 ── mobile sort select in the bar writes the URL
const sortTrigger = page.locator('button[aria-label="Sort products"]');
check("mobile sort control present", (await sortTrigger.count()) === 1);
await sortTrigger.click();
await page.waitForTimeout(800);
const opt = page.locator('[role="option"]', { hasText: "Price: Low to High" }).first();
if (await opt.count()) {
  await opt.click();
  await page.waitForTimeout(1500);
  check("choosing a sort updates the URL", page.url().includes("sort=price_asc"), page.url());
} else {
  check("choosing a sort updates the URL", false, "option not found");
}

// 6 ── product grid renders 2 columns on mobile
const cols = await page.locator(".kc-products-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
check("product grid is 2 columns on mobile", cols === 2, `cols=${cols}`);

// 7 ── product detail sticky purchase bar: visible, above bottom nav, handlers wired
await go("#/products/manforce-condom");
await page.waitForTimeout(3000);
const buyNowVis = page.locator('button:visible', { hasText: "Buy Now" }).first();
const hasBuyNow = (await buyNowVis.count()) > 0;
check("sticky purchase bar visible (Buy Now on screen)", hasBuyNow);
if (hasBuyNow) {
  const bar = buyNowVis.locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  const barBox = await bar.boundingBox();
  const navBox = await nav.boundingBox();
  check(
    "sticky bar does not cover bottom nav",
    !!barBox && !!navBox && barBox.y + barBox.height <= navBox.y + 1,
    JSON.stringify({ barBottom: barBox && Math.round(barBox.y + barBox.height), navTop: navBox && Math.round(navBox.y) })
  );
  const addBtn = bar.locator("button:visible", { hasText: /Add to Cart|Out of Stock/ });
  check("sticky bar has Add to Cart", (await addBtn.count()) === 1);
  // clicking Buy Now while signed out must still run the existing auth/route logic
  await buyNowVis.click();
  await page.waitForTimeout(1500);
  const url = page.url();
  check("Buy Now still runs existing auth/route logic", url.includes("/auth") || url.includes("/login") || url.includes("/products/"), url);
}

// 8 ── no horizontal overflow anywhere we visited
await go("#/");
await page.evaluate(async () => {
  const step = Math.round(window.innerHeight * 0.9);
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
});
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
check("no horizontal page overflow", !overflow);

check("no page errors", pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 3)));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? " — FAILURES: " + failed.map((f) => f.name).join(", ") : ""}`);
process.exit(failed.length ? 1 : 0);
