import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

await go(page, "#/products");
// Click first product card
const card = page.locator("[data-slot='card']").filter({ hasText: /₹/ }).first();
const cardTitle = await card.innerText().catch(() => "(no card)");
await card.click().catch((e) => console.log("click err", e.message));
await page.waitForTimeout(2500);
const urlA = page.url();
const h1A = await page.locator("h1").first().innerText().catch(() => "(no h1)");
const crumbsA = await page.locator("nav li a, [class*='breadcrumb'] a").evaluateAll((els) => els.map((e) => (e.innerText || "").trim()).slice(0, 5));
const imgsA = await page.evaluate(() => Array.from(document.querySelectorAll("main img, [class*='gallery'] img, img")).map((i) => (i.currentSrc || i.src).slice(-60)).slice(0, 6));
const mainSrcA = await page.locator("img").first().getAttribute("src");
await page.screenshot({ path: "/tmp/qa-04-a.png" });

// Back to list, click a different product (B)
await go(page, "#/products");
const cards = page.locator("[data-slot='card']").filter({ hasText: /₹/ });
const n = await cards.count();
let bIdx = Math.min(3, n - 1);
await cards.nth(bIdx).click().catch((e) => console.log("click B err", e.message));
await page.waitForTimeout(2500);
const urlB = page.url();
const h1B = await page.locator("h1").first().innerText().catch(() => "(no h1)");
const mainSrcB = await page.locator("img").first().getAttribute("src");
const crumbsB = await page.locator("nav li a, [class*='breadcrumb'] a").evaluateAll((els) => els.map((e) => (e.innerText || "").trim()).slice(0, 5));
await page.screenshot({ path: "/tmp/qa-04-b.png" });

// Gallery thumbnails: click 2nd thumb, check main image changes
const thumbCount = await page.locator("[class*='gallery'] img, main img").count();
const before = mainSrcB;
const thumbs = page.locator("img");
const tcount = await thumbs.count();
if (tcount > 2) {
  await thumbs.nth(1).click().catch(() => {});
  await page.waitForTimeout(1200);
}
const after = await page.locator("img").first().getAttribute("src");

report("Test 3: product detail + A->B", {
  cardPreview: cardTitle.replace(/\s+/g, " ").slice(0, 120),
  urlA, h1A, crumbsA, mainSrcA,
  urlB, h1B, crumbsB, mainSrcB,
  thumbCount: tcount,
  galleryChanged: before !== after,
  before: (before || "").slice(-60),
  after: (after || "").slice(-60),
  consoleErrors: interesting(consoleErrors),
  pageErrors,
  badResponses,
});

await browser.close();
