import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

// --- A: header search box -> suggestions -> results
await go(page, "#/");
const searchInput = page.locator("input[placeholder*='Search'], input[type='search']").first();
await searchInput.click().catch(() => {});
await searchInput.fill("vol").catch((e) => console.log("fill err", e.message));
await page.waitForTimeout(1800);
const suggestions = await page.locator("[role='option'], [class*='suggestion'], [class*='autocomplete'] li, [class*='suggestions'] *").evaluateAll((els) =>
  els.slice(0, 8).map((e) => (e.innerText || "").trim().replace(/\s+/g, " ").slice(0, 60)).filter(Boolean)
);
await searchInput.press("Enter");
await page.waitForTimeout(2500);
const searchUrl = page.url();
const searchH1 = await page.locator("h1").first().innerText().catch(() => "(no h1)");
const resultCount = await page.locator("[data-slot='card']").filter({ hasText: /₹/ }).count();
await page.screenshot({ path: "/tmp/qa-05-search.png" });

// --- B: filters + pagination URL state
const beforeUrl = page.url();
await page.locator("button").filter({ hasText: /Sort|Popularity|Price/i }).first().click().catch((e) => console.log("sort err", e.message));
await page.waitForTimeout(800);
const afterSortUrl = page.url();
await page.keyboard.press("Escape");
const nextBtn = page.getByRole("button", { name: /^Next$/ }).or(page.getByRole("link", { name: /^Next$/ })).first();
const hasNext = await nextBtn.count();
if (hasNext) {
  await nextBtn.click({ force: true }).catch((e) => console.log("next err", e.message));
  await page.waitForTimeout(2500);
}
const afterPageUrl = page.url();
const page2Count = await page.locator("[data-slot='card']").filter({ hasText: /₹/ }).count();

// --- C: product -> add to cart / buy now as guest
await go(page, "#/products/volini-gel");
const btnTexts = await page.locator("main button").evaluateAll((els) => els.map((e) => (e.innerText || "").trim()).filter(Boolean).slice(0, 20));
const addToCart = page.getByRole("button", { name: /add to cart/i }).first();
const acCount = await addToCart.count();
let afterAddUrl = null;
let toast = null;
if (acCount) {
  await addToCart.click().catch((e) => console.log("atc err", e.message));
  await page.waitForTimeout(2500);
  afterAddUrl = page.url();
  toast = await page.locator("[data-sonner-toast], [role='status'], [role='alert']").first().innerText().catch(() => null);
}
const cartBadge = await page.locator("[class*='cart'] span, [class*='badge']").first().innerText().catch(() => null);

// go to cart
await go(page, "#/cart");
const cartBody = (await page.locator("main, body").first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 500);
const cartUrl = page.url();

// --- D: checkout as guest
await go(page, "#/checkout");
await page.waitForTimeout(1500);
const checkoutUrl = page.url();
const checkoutHead = (await page.locator("h1, h2").first().innerText().catch(() => "(none)"));

report("Test 4/5: search, filters, cart, checkout gate", {
  suggestions, searchUrl, searchH1, resultCount,
  beforeUrl, afterSortUrl, hasNext, afterPageUrl, page2Count,
  productButtons: btnTexts,
  addToCartCount: acCount, afterAddUrl, toast, cartBadge,
  cartUrl, cartBody,
  checkoutUrl, checkoutHead,
  consoleErrors: interesting(consoleErrors),
  pageErrors,
  badResponses,
});

await browser.close();
