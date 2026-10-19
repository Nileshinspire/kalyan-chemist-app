// Interaction test on the EDITED product detail page:
// 1) signed-out "Add to Cart" -> sign-in toast + redirect preserving returnTo
// 2) signed-in "Add to Cart" -> success toast
import { launch, go, assertPreview, report, interesting } from "./harness.mjs";
import { anonymousSignIn, injectSession } from "./authSession.mjs";

await assertPreview();

const DETAIL = "#/products/ecosprin-75mg";

const { browser, page, pageErrors, consoleErrors } = await launch();
await go(page, DETAIL);
await page.waitForTimeout(3000);

const clickAdd = async () => {
  const btn = page.locator("main button", { hasText: /^Add to Cart$/i }).first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click();
  await page.waitForTimeout(1800);
  return await page.evaluate(() => ({
    url: location.hash,
    toasts: [...document.querySelectorAll("[data-sonner-toast]")].map((t) => (t.textContent || "").trim()).slice(0, 4),
  }));
};

// 1) signed out
report("Detail page — signed-out Add to Cart", await clickAdd());

// 2) signed in
try {
  const session = await anonymousSignIn();
  await injectSession(page, session);
  await go(page, DETAIL);
  await page.waitForTimeout(3000);
  const res = await clickAdd();
  // confirm the cart actually received the item
  await go(page, "#/cart");
  await page.waitForTimeout(2500);
  const cart = await page.evaluate(() => ({
    text: (document.querySelector("main")?.innerText || "").replace(/\s+/g, " ").slice(0, 200),
  }));
  report("Detail page — signed-in Add to Cart", { ...res, cartAfter: cart.text });
} catch (e) {
  console.log("signed-in flow failed:", e?.message || String(e));
}

console.log("pageErrors:", interesting(pageErrors).slice(0, 4));
console.log("consoleErrors:", interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|403|favicon/i.test(e)).slice(0, 4));
await browser.close();
