import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

// Guest clicks "Cart" (add to cart) button on a product card in the listing
await go(page, "#/products");
const cards = page.locator("[data-slot='card']").filter({ hasText: /₹/ });
const firstCardButtons = await cards.first().locator("button").evaluateAll((els) =>
  els.map((e) => (e.innerText || "").trim() || e.getAttribute("aria-label") || "(icon)")
);
await cards.first().getByRole("button").nth(1).click().catch((e) => console.log("card cart click:", e.message));
await page.waitForTimeout(2500);
const afterCardCartUrl = page.url();
const toast1 = await page.locator("[data-sonner-toast]").first().innerText().catch(() => null);

// Guest clicks wishlist heart on detail page
await go(page, "#/products/telma-40");
const wishBtn = page.locator("button[aria-label*='ish'], button[aria-label*='Wish']").first();
const wishCount = await wishBtn.count();
if (wishCount) await wishBtn.click().catch(() => {});
await page.waitForTimeout(2000);
const afterWishUrl = page.url();
const toast2 = await page.locator("[data-sonner-toast]").last().innerText().catch(() => null);

// Guest clicks Buy Now on detail page
await go(page, "#/products/telma-40");
const buyNow = page.getByRole("button", { name: /buy now/i }).first();
const bnCount = await buyNow.count();
if (bnCount) await buyNow.click().catch((e) => console.log("buynow:", e.message));
await page.waitForTimeout(2500);
const afterBuyNowUrl = page.url();
const toast3 = await page.locator("[data-sonner-toast]").last().innerText().catch(() => null);

// Guest clicks "Write a Review"
await go(page, "#/products/telma-40");
const reviewBtn = page.getByRole("button", { name: /write a review/i }).first();
const rvCount = await reviewBtn.count();
if (rvCount) await reviewBtn.click().catch(() => {});
await page.waitForTimeout(2000);
const afterReviewUrl = page.url();

report("Test 6: guest auth gates returnTo", {
  cardButtons: firstCardButtons,
  afterCardCartUrl, toast1,
  wishCount, afterWishUrl, toast2,
  bnCount, afterBuyNowUrl, toast3,
  rvCount, afterReviewUrl,
  consoleErrors: interesting(consoleErrors),
  pageErrors,
  badResponses,
});

await browser.close();
