// Interaction test: Add to Cart from a product card.
// 1) Signed-out click -> sign-in toast + redirect to /auth?returnTo=...
// 2) Signed-in (anonymous Convex session) click -> success toast, cart count bumps.
import { launch, go, assertPreview, report, interesting } from "./harness.mjs";
import { anonymousSignIn, injectSession } from "./authSession.mjs";

await assertPreview();

const { browser, context, page, pageErrors } = await launch();
await go(page, "#/");

// Scroll to the first product card with an enabled Add button.
const addToCartOnFirstCard = async () => {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((b) => /^add$/i.test((b.textContent || "").trim()));
    btns[0]?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(600);
  const btn = page.locator("button", { hasText: /^Add$/ }).first();
  await btn.click();
  await page.waitForTimeout(1600);
  return await page.evaluate(() => ({
    url: location.hash,
    toasts: [...document.querySelectorAll("[data-sonner-toast]")].map((t) => (t.textContent || "").trim()).slice(0, 4),
  }));
};

// 1) signed out
const signedOut = await addToCartOnFirstCard();
report("Signed-out Add click", signedOut);

// 2) signed in via the app's own anonymous auth
let signedIn = { skipped: true };
try {
  const session = await anonymousSignIn();
  await injectSession(page, session);
  await go(page, "#/");
  await page.waitForTimeout(2500);
  const before = await page.evaluate(() => document.body.innerText.match(/cart\s*\(?(\d+)\)?/i)?.[1] || null);
  const res = await addToCartOnFirstCard();
  const after = await page.evaluate(() => document.body.innerText.match(/cart\s*\(?(\d+)\)?/i)?.[1] || null);
  signedIn = { ...res, cartCountBefore: before, cartCountAfter: after };
} catch (e) {
  signedIn = { skipped: false, error: e?.message || String(e) };
}
report("Signed-in Add click", signedIn);

console.log("pageErrors:", interesting(pageErrors).slice(0, 5));
await browser.close();
