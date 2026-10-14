import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

const results = {};

async function toast() {
  return page.locator("[data-sonner-toast]").last().innerText().catch(() => null);
}

// 1. detail: add to cart
await go(page, "#/products/telma-40");
await page.getByRole("button", { name: /add to cart/i }).first().click().catch((e) => console.log("atc", e.message));
await page.waitForTimeout(2000);
results.detailAddToCart = { url: page.url().replace("https://sunny-baths-help.freebuff.dev", ""), toast: await toast() };

// 2. detail: buy now
await go(page, "#/products/telma-40");
await page.getByRole("button", { name: /buy now/i }).first().click().catch((e) => console.log("bn", e.message));
await page.waitForTimeout(2000);
results.detailBuyNow = { url: page.url().replace("https://sunny-baths-help.freebuff.dev", ""), toast: await toast() };

// 3. detail: write a review
await go(page, "#/products/telma-40");
await page.getByRole("button", { name: /write a review/i }).first().click().catch((e) => console.log("rv", e.message));
await page.waitForTimeout(2000);
results.detailReview = { url: page.url().replace("https://sunny-baths-help.freebuff.dev", ""), toast: await toast() };

// 4. listing card: Cart button
await go(page, "#/products");
const card = page.locator("[data-slot='card']").filter({ hasText: /₹/ }).first();
const cardTitle = (await card.innerText()).replace(/\s+/g, " ").slice(0, 50);
await card.getByRole("button", { name: /^Cart$/ }).first().click().catch((e) => console.log("cc", e.message));
await page.waitForTimeout(2200);
results.listingCardCart = { cardTitle, url: page.url().replace("https://sunny-baths-help.freebuff.dev", ""), toast: await toast() };

// 5. listing card: wishlist heart (first icon button)
await go(page, "#/products");
const card2 = page.locator("[data-slot='card']").filter({ hasText: /₹/ }).first();
await card2.locator("button").first().click().catch((e) => console.log("wh", e.message));
await page.waitForTimeout(2200);
results.listingCardWishlist = { url: page.url().replace("https://sunny-baths-help.freebuff.dev", ""), toast: await toast() };

// 6. home card: Cart button
await go(page, "#/");
const homeCard = page.locator("[data-slot='card']").filter({ hasText: /₹/ }).first();
await homeCard.getByRole("button", { name: /^Cart$/ }).first().click().catch((e) => console.log("hc", e.message));
await page.waitForTimeout(2200);
results.homeCardCart = { url: page.url().replace("https://sunny-baths-help.freebuff.dev", ""), toast: await toast() };

// 7. cart page in-page sign-in
await go(page, "#/cart");
await page.locator("main").getByRole("button", { name: /^Sign In$/ }).first().click().catch((e) => console.log("ci", e.message));
await page.waitForTimeout(1500);
results.cartSignIn = { url: page.url().replace("https://sunny-baths-help.freebuff.dev", "") };

report("Post-fix verification", {
  ...results,
  rawConvexErrors: consoleErrors.filter((c) => /CONVEX|Server Error/i.test(c)),
  consoleErrors: interesting(consoleErrors),
  pageErrors,
  badResponses,
});

await browser.close();
