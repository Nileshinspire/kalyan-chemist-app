// Focused repro: does clicking "Remove" on a wishlist card also navigate?
// Run: node qa/t25-wishlist-remove-nav.mjs
import { launch, go, report } from "./harness.mjs";
import { anonymousSignIn, injectSession, hash, queryPublic } from "./authSession.mjs";

const { browser, page, pageErrors } = await launch();
const R = {};
const session = await anonymousSignIn();
await go(page, "#/");
await injectSession(page, session);

const items = await queryPublic(session.convexUrl, "publicProducts:searchPage", { query: "", sortBy: "price_asc", offset: 0, limit: 3 });
const p = items?.items?.[0];
R.product = { name: p.name, slug: p.slug };

// seed the wishlist
await go(page, `#/products/${p.slug}`);
await page.locator("button:has(svg.lucide-heart)").first().click().catch(() => {});
await page.waitForTimeout(2000);

await go(page, "#/account/wishlist");
R.hashOnWishlist = hash(page);
const trash = page.locator("main button:has(svg.lucide-trash2)").first();
R.trashCount = await page.locator("main button:has(svg.lucide-trash2)").count();
R.trashInsideClickable = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("main button")].find((b) => b.querySelector("svg.lucide-trash2"));
  if (!btn) return null;
  // walk up looking for an ancestor carrying an onClick (React attaches via __reactProps)
  let el = btn.parentElement;
  const chain = [];
  while (el && el.tagName !== "MAIN") {
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
    if (key && typeof el[key]?.onClick === "function") chain.push(el.tagName + "." + String(el.className).split(" ")[0]);
    el = el.parentElement;
  }
  return chain;
});

await trash.click().catch((e) => (R.clickError = e.message));
await page.waitForTimeout(2500);
R.hashAfterRemoveClick = hash(page);
R.toasts = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
R.navigatedAway = hash(page) !== R.hashOnWishlist;
R.h1 = await page.locator("h1").allInnerTexts().catch(() => []);
R.pageErrors = pageErrors;

report("T25 repro: wishlist remove-button navigation", R);
await browser.close();