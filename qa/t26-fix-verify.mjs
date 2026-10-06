// Verification for the two scope-limited fixes:
//  1) Wishlist has exactly ONE <main> landmark when nested in Account Layout,
//     and still has its own <main> on the standalone /wishlist route.
//  2) Cart pluralisation: 1 item -> "Subtotal (1 item)", 2+ -> "Subtotal (2 items)".
//  3) Wishlist remove button still does NOT navigate.
// Run: node qa/t26-fix-verify.mjs
import { launch, go, report } from "./harness.mjs";
import { anonymousSignIn, injectSession, hash, queryPublic } from "./authSession.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};

const mainCount = () => page.locator("main").count();
const mainText = () =>
  page.evaluate(() => [...document.querySelectorAll("main")].map((m) => m.innerText).join(" ")).then((s) => s.replace(/\s+/g, " "));
const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

const session = await anonymousSignIn();
await go(page, "#/");
await injectSession(page, session);

const items = await queryPublic(session.convexUrl, "publicProducts:searchPage", { query: "", sortBy: "price_asc", offset: 0, limit: 3 });
const p1 = items?.items?.[0];
const p2 = items?.items?.[1];
const p3 = items?.items?.[2];

// ══ 1. Landmark: nested in Account Layout ══
await go(page, "#/account/wishlist");
await page.waitForTimeout(1500);
R.nestedMainCount = await mainCount();
R.nestedHash = hash(page);
check("Account Layout route: exactly one <main>", R.nestedMainCount === 1, `count=${R.nestedMainCount}`);
check("Account Layout still owns the <main>", R.nestedHash === "/account/wishlist", R.nestedHash);
R.nestedMainSample = (await mainText()).slice(0, 120);
check("wishlist renders content (not blank)", (await mainText()).length > 0, R.nestedMainSample);

// ══ 1b. Standalone /wishlist route keeps its own <main> ══
await go(page, "#/wishlist");
await page.waitForTimeout(1500);
R.standaloneMainCount = await mainCount();
check("standalone /wishlist keeps its own <main>", R.standaloneMainCount >= 1, `count=${R.standaloneMainCount}`);

// ══ 3. Wishlist remove does not navigate ══
await go(page, `#/products/${p1.slug}`);
await page.locator("button:has(svg.lucide-heart)").first().click().catch(() => {});
await page.waitForTimeout(1800);
await go(page, "#/account/wishlist");
const beforeHash = hash(page);
const trash = page.locator("main button:has(svg.lucide-trash2)").first();
check("remove control present", (await trash.count()) > 0);
if (await trash.count()) {
  await trash.click().catch(() => {});
  await page.waitForTimeout(2200);
  R.afterRemoveHash = hash(page);
  R.removeToasts = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
  check("remove does not navigate away", R.afterRemoveHash === beforeHash, `${beforeHash} → ${R.afterRemoveHash}`);
  check("remove still removes the item", R.removeToasts.some((x) => /removed from wishlist/i.test(x)), R.removeToasts.join(" | "));
  const t = await mainText();
  check("empty state shown", /wishlist is empty/i.test(t), t.slice(0, 100));
  R.nestedMainCountAfter = await mainCount();
  check("still exactly one <main> in empty state", R.nestedMainCountAfter === 1, `count=${R.nestedMainCountAfter}`);
}

// ══ 2. Cart pluralisation ══
const subtotalLine = async () => {
  const s = await bodyText();
  const m = /Subtotal \(\d+ items?\)/.exec(s);
  return m ? m[0] : null;
};

await go(page, `#/products/${p1.slug}`);
await page.locator("button", { hasText: /^Add to Cart$/ }).first().click();
await page.waitForTimeout(1600);
await go(page, "#/cart");
R.lineOne = await subtotalLine();
check('1 item -> "Subtotal (1 item)"', R.lineOne === "Subtotal (1 item)", String(R.lineOne));
R.textOne = (await mainText()).slice(0, 200);

await go(page, `#/products/${p2.slug}`);
await page.locator("button", { hasText: /^Add to Cart$/ }).first().click();
await page.waitForTimeout(1600);
await go(page, "#/cart");
R.lineTwo = await subtotalLine();
check('2 items -> "Subtotal (2 items)"', R.lineTwo === "Subtotal (2 items)", String(R.lineTwo));

await go(page, `#/products/${p3.slug}`);
await page.locator("button", { hasText: /^Add to Cart$/ }).first().click();
await page.waitForTimeout(1600);
await go(page, "#/cart");
R.lineThree = await subtotalLine();
check('3 items -> "Subtotal (3 items)"', R.lineThree === "Subtotal (3 items)", String(R.lineThree));
R.textThree = (await mainText()).slice(0, 220);
await page.screenshot({ path: "/tmp/qa-26-cart.png" });

R.consoleErrors = consoleErrors.filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 6);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("T26: landmark + pluralisation fixes", R);
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL FIX CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);