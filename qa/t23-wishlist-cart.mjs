// Authenticated QA — corrected address checks + Wishlist + Cart operations.
// Run: node qa/t23-wishlist-cart.mjs
import { launch, go, report, interesting } from "./harness.mjs";
import { anonymousSignIn, injectSession, hash, queryPublic, pageSummary } from "./authSession.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};
const toasts = async () =>
  (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).map((t) => t.replace(/\s+/g, " ").trim());

const session = await anonymousSignIn();
await go(page, "#/");
await injectSession(page, session);

// ══ Profile: email validation with a valid name present ══
await go(page, "#/account/profile");
await page.locator("input#name").fill("QA Test Customer");
await page.locator("input#email").fill("not-an-email");
await page.locator("button", { hasText: /^Save( Changes)?$/ }).first().click();
await page.waitForTimeout(900);
let t = await toasts();
check("invalid email rejected (name valid)", t.some((x) => /valid email/i.test(x)), t.join(" | "));
// restore a valid profile
await page.locator("input#email").fill("qa.customer@example.com");
await page.locator("button", { hasText: /^Save( Changes)?$/ }).first().click();
await page.waitForTimeout(1500);

// ══ Addresses: precise default-badge checks + in-app Back ══
await go(page, "#/account/addresses");
const badgeCount = async () =>
  page.locator('main span:text-is("Default"), main [data-slot="badge"]:has-text("Default")').count();
R.addressBadges = await badgeCount();
check("exactly one default badge on saved address", R.addressBadges === 1, `badges=${R.addressBadges}`);
const addrText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
check("saved address persisted across reload", /Flat 9C/.test(addrText) && /421306/.test(addrText), addrText.slice(0, 140));

// Back navigation via in-app navigation (sidebar click), not a fresh load
await go(page, "#/account");
await page.locator("a", { hasText: /^Addresses$/ }).first().click();
await page.waitForTimeout(1400);
check("sidebar → Addresses", hash(page) === "/account/addresses", hash(page));
await page.goBack();
await page.waitForTimeout(1300);
const backSum = await pageSummary(page);
check("single Back from Addresses → dashboard (no loop/stale)", hash(page) === "/account" && /Welcome back/i.test(backSum.h1.join(" ")), `${hash(page)} :: ${backSum.h1.join(" | ")}`);

// ══ Wishlist ══
const items = await queryPublic(session.convexUrl, "publicProducts:searchPage", { query: "", sortBy: "price_asc", offset: 0, limit: 5 });
const p1 = items?.items?.[0];
R.wishlistProduct = p1 ? { name: p1.name, slug: p1.slug } : null;
await go(page, `#/products/${p1.slug}`);
const heartBtn = page.locator("button:has(svg.lucide-heart)").first();
check("wishlist (heart) control on product page", (await heartBtn.count()) > 0);
if (await heartBtn.count()) {
  await heartBtn.click().catch(() => {});
  await page.waitForTimeout(1500);
  t = await toasts();
  R.wishlistToast = t;
  const filled = await page.locator("button:has(svg.lucide-heart) svg.lucide-heart").first().getAttribute("class").catch(() => "");
  check("heart shows added state", /fill-rose-500/.test(filled || ""), filled || "(no class)");
}
await go(page, "#/account/wishlist");
let wl = (await page.locator("main").innerText()).replace(/\s+/g, " ");
check("wishlist lists the product", new RegExp(p1.name.split(" ")[0], "i").test(wl), wl.slice(0, 160));
await page.screenshot({ path: "/tmp/qa-23-wishlist.png" });

// open the product from the wishlist, then remove it
const wlLink = page.locator("main button, main a").filter({ hasText: new RegExp(p1.name.split(" ")[0], "i") }).first();
if (await wlLink.count()) {
  await wlLink.click().catch(() => {});
  await page.waitForTimeout(1500);
  R.wishlistOpenHash = hash(page);
  check("wishlist item opens its product", /\/products\//.test(hash(page)), hash(page));
  // remove from the product page
  const heart2 = page.locator("button:has(svg.lucide-heart)").first();
  if (await heart2.count()) { await heart2.click().catch(() => {}); await page.waitForTimeout(1500); }
  await go(page, "#/account/wishlist");
  wl = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("wishlist item removed", !new RegExp(p1.name.split(" ")[0], "i").test(wl), wl.slice(0, 160));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  wl = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("wishlist state persists after refresh (still empty)", /empty/i.test(wl), wl.slice(0, 120));
}

// ══ Cart ══
const p2 = items?.items?.[1];
await go(page, `#/products/${p2.slug}`);
await page.locator("button", { hasText: /^Add to Cart$/ }).first().click();
await page.waitForTimeout(1600);
t = await toasts();
R.cartAddToast = t;
await go(page, "#/cart");
let cart = (await page.locator("main").innerText()).replace(/\s+/g, " ");
check("product added to cart", new RegExp(p2.name.split(" ")[0], "i").test(cart), cart.slice(0, 160));

const priceOf = async () => {
  const s = await page.locator("main").innerText();
  const row = /Subtotal[^₹]*₹([\d,]+)/.exec(s);
  return row ? Number(row[1].replace(/,/g, "")) : null;
};
const sub1 = await priceOf();
const plus = page.locator("button:has(svg.lucide-plus)").first();
check("quantity increase control present", (await plus.count()) > 0);
if (await plus.count()) {
  await plus.click();
  await page.waitForTimeout(1500);
  const sub2 = await priceOf();
  check("quantity increase updates subtotal", sub2 != null && sub1 != null && sub2 > sub1, `${sub1} → ${sub2}`);
  const minus = page.locator("button:has(svg.lucide-minus)").first();
  if (await minus.count()) { await minus.click(); await page.waitForTimeout(1500); }
  const sub3 = await priceOf();
  check("quantity decrease restores subtotal", sub3 === sub1, `${sub2} → ${sub3} (expected ${sub1})`);
}
cart = (await page.locator("main").innerText()).replace(/\s+/g, " ");
check("cart shows Delivery Free (config fee ₹0)", /Delivery Free/.test(cart), cart.slice(0, 200));
await page.screenshot({ path: "/tmp/qa-23-cart.png" });

// remove item
const delBtns = page.locator('main button[aria-label*="emove" i], main button:has(svg.lucide-trash2)');
const delCount = await delBtns.count();
check("remove control present", delCount >= 1, `count=${delCount}`);
if (delCount >= 1) {
  await delBtns.first().click().catch(() => {});
  await page.waitForTimeout(1600);
  t = await toasts();
  R.cartRemoveToast = t;
  cart = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("item removed → empty cart state", /Cart is Empty/i.test(cart), cart.slice(0, 120));
}

// add again and proceed to checkout (leave cart populated for the checkout test)
await go(page, `#/products/${p2.slug}`);
await page.locator("button", { hasText: /^Add to Cart$/ }).first().click();
await page.waitForTimeout(1500);
await go(page, "#/cart");
await page.locator("button", { hasText: /Proceed to Checkout/i }).first().click();
await page.waitForTimeout(2000);
check("Cart → Checkout navigates", /^\/checkout/.test(hash(page)), hash(page));
R.checkoutLanding = await pageSummary(page);

R.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 8);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 23: addresses precision + wishlist + cart (authenticated)", R);
console.log(`\n${R.failures.length ? "FAILURES:" : "ALL WISHLIST/CART CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);
