import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

// Locate broken images on the home page
await go(page, "#/");
const broken = await page.evaluate(() =>
  Array.from(document.images)
    .filter((i) => !i.complete || i.naturalWidth === 0)
    .map((i) => ({
      src: (i.currentSrc || i.src).slice(0, 140),
      alt: i.alt,
      w: Math.round(i.getBoundingClientRect().width),
      h: Math.round(i.getBoundingClientRect().height),
      section: (i.closest("section")?.innerText || i.parentElement?.innerText || "").replace(/\s+/g, " ").slice(0, 80),
    }))
);

// Products list
await go(page, "#/products");
const listH1 = await page.locator("h1").first().innerText().catch(() => "(no h1)");
const cards = await page.locator("a[href*='#/products/']").evaluateAll((els) =>
  els.slice(0, 6).map((e) => ({ text: (e.innerText || "").replace(/\s+/g, " ").slice(0, 60), href: e.getAttribute("href") }))
);
const cardCount = await page.locator("a[href*='#/products/']").count();
const pagination = await page.locator("button, a").filter({ hasText: /^(Next|Prev|\d+)$/ }).evaluateAll((els) =>
  els.slice(0, 12).map((e) => (e.innerText || "").trim())
);
await page.screenshot({ path: "/tmp/qa-02-products.png" });

// Click into first product detail
const firstHref = cards[0]?.href;
if (firstHref) {
  await page.locator(`a[href="${firstHref}"]`).first().click();
  await page.waitForTimeout(2500);
}
const detailUrl = page.url();
const detailH1 = await page.locator("h1").first().innerText().catch(() => "(no h1)");
const breadcrumb = await page.locator("nav[aria-label*='readcrumb'], .breadcrumb, [class*='breadcrumb']").first().innerText().catch(() => "(none)");
const thumbs = await page.locator("img").count();
const buyBtns = await page.locator("button").evaluateAll((els) =>
  els.map((e) => (e.innerText || "").trim()).filter(Boolean).slice(0, 14)
);
const detailBroken = await page.evaluate(() =>
  Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => (i.currentSrc || i.src).slice(0, 120))
);
await page.screenshot({ path: "/tmp/qa-03-detail.png" });

report("Test 2: Products list + detail", {
  homeBrokenImages: broken,
  listH1,
  cardCount,
  cards,
  pagination,
  detailUrl,
  detailH1,
  breadcrumb,
  imgCount: thumbs,
  buttons: buyBtns,
  detailBrokenImages: detailBroken,
  consoleErrors: interesting(consoleErrors),
  pageErrors,
  badResponses,
});

await browser.close();
