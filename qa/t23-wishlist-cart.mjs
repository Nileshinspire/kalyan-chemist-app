// Authenticated QA — corrected address checks + Wishlist + Cart operations.
// Run: node qa/t23-wishlist-cart.mjs
import { launch, go, report, interesting, assertPreview } from "./harness.mjs";
import { anonymousSignIn, injectSession, ensureAddress, hash, queryPublic, pageSummary } from "./authSession.mjs";

await assertPreview();

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};
const toasts = async () =>
  (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).map((x) => x.replace(/\s+/g, " ").trim());

// Some account sub-pages render their own <main> inside the account layout's
// <main>, so read ALL main elements instead of asserting on a single node.
const mainText = async () =>
  (await page.evaluate(() => [...document.querySelectorAll("main")].map((m) => m.innerText).join(" ")))
    .replace(/\s+/g, " ");

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
// This account is brand new (anonymous sign-in), so create its own fixture first.
await go(page, "#/account/addresses");
await ensureAddress(page);
const badgeCount = async () =>
  page.locator('main span:text-is("Default"), main [data-slot="badge"]:has-text("Default")').count();
R.addressBadges = await badgeCount();
check("exactly one default badge on saved address", R.addressBadges === 1, `badges=${R.addressBadges}`);
const addrText = await mainText();
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

// sidebar → Addresses again after Back (no stale subsection / no duplicate history)
await page.locator("a", { hasText: /^Addresses$/ }).first().click();
await page.waitForTimeout(1300);
check("Addresses reachable again after Back", hash(page) === "/account/addresses", hash(page));

// ══ Wishlist ══
const items = await queryPublic(session.convexUrl, "publicProducts:searchPage", { query: "", sortBy: "price_asc", offset: 0, limit: 6 });
const p1 = items?.items?.[0];
R.wishlistProduct = p1 ? { name: p1.name, slug: p1.slug } : null;
const key1 = p1.name.split(" ")[0];

await go(page, `#/products/${p1.slug}`);
const heartBtn = page.locator("button:has(svg.lucide-heart)").first();
check("wishlist (heart) control on product page", (await heartBtn.count()) > 0);
if (await heartBtn.count()) {
  await heartBtn.click().catch(() => {});
  await page.waitForTimeout(1800);
  t = await toasts();
  R.wishlistToast = t;
  const filled = await page.locator("button:has(svg.lucide-heart) svg.lucide-heart").first().getAttribute("class").catch(() => "");
  check("heart shows added state", /fill-rose-500/.test(filled || ""), filled || "(no class)");
}

// open the wishlist
await go(page, "#/account/wishlist");
let wl = await mainText();
R.wishlistListing = wl.slice(0, 200);
check("wishlist lists the product", new RegExp(key1, "i").test(wl), wl.slice(0, 160));
check("wishlist count reflects 1 saved item", /1 item\(s\) saved/i.test(wl), wl.slice(0, 80));
await page.screenshot({ path: "/tmp/qa-23-wishlist.png" });

// open the product from the wishlist (clickable <h3>, not an anchor)
const wlTitle = page.locator("main h3").filter({ hasText: new RegExp(key1, "i") }).first();
check("wishlist entry exposes a clickable title", (await wlTitle.count()) > 0);
if (await wlTitle.count()) {
  await wlTitle.click().catch(() => {});
  await page.waitForTimeout(1800);
  R.wishlistOpenHash = hash(page);
  check("wishlist item opens its product", hash(page) === `/products/${p1.slug}`, hash(page));
  // the heart on the product page must reflect the saved state
  const heart2 = page.locator("button:has(svg.lucide-heart)").first();
  const heartCls = (await heart2.count())
    ? (await heart2.locator("svg.lucide-heart").first().getAttribute("class").catch(() => "")) || ""
    : "";
  check("heart state persists when reopening the product", /fill-rose-500/.test(heartCls), heartCls || "(no class)");
}

// remove it directly from the wishlist (Trash2 button on the card)
await go(page, "#/account/wishlist");
const wlTrash = page.locator("main button:has(svg.lucide-trash2)").first();
check("wishlist remove control present", (await wlTrash.count()) > 0);
if (await wlTrash.count()) {
  await wlTrash.click().catch(() => {});
  await page.waitForTimeout(2000);
  t = await toasts();
  R.wishlistRemoveToast = t;
  wl = await mainText();
  check("wishlist item removed", !new RegExp(key1, "i").test(wl), wl.slice(0, 160));
  check("empty state shown after removal", /wishlist is empty/i.test(wl), wl.slice(0, 120));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  wl = await mainText();
  check("wishlist state persists after refresh (still empty)", /wishlist is empty/i.test(wl), wl.slice(0, 120));
}

// re-add, then use "Move to Cart" from the wishlist
await go(page, `#/products/${p1.slug}`);
await page.locator("button:has(svg.lucide-heart)").first().click().catch(() => {});
await page.waitForTimeout(1800);
await go(page, "#/account/wishlist");
const moveBtn = page.locator("main button", { hasText: /Move to Cart/i }).first();
check("Move to Cart control present on wishlist item", (await moveBtn.count()) > 0);
if (await moveBtn.count()) {
  await moveBtn.click().catch(() => {});
  await page.waitForTimeout(2200);
  t = await toasts();
  R.moveToCartToast = t;
  check("Move to Cart succeeds", t.some((x) => /moved to cart/i.test(x)), t.join(" | "));
  wl = await mainText();
  check("Move to Cart removes the wishlist entry", !new RegExp(key1, "i").test(wl), wl.slice(0, 160));
}
await go(page, "#/cart");
let cart = await mainText();
check("Move to Cart landed the item in the cart", new RegExp(key1, "i").test(cart), cart.slice(0, 160));

// ══ Cart: quantity +/-, subtotal, remove ══
const priceOf = async () => {
  const s = await mainText();
  const row = /Subtotal[^₹]*₹([\d,]+)/.exec(s);
  return row ? Number(row[1].replace(/,/g, "")) : null;
};
const qtyOf = async () => {
  const s = await mainText();
  const m = /Subtotal\s*\((\d+)\s*items?\)/.exec(s);
  return m ? Number(m[1]) : null;
};
const sub1 = await priceOf();
const qty1 = await qtyOf();
R.cartInitial = { sub1, qty1 };
check("cart subtotal parses", sub1 != null && sub1 > 0, `subtotal=${sub1}`);

const plus = page.locator("main button:has(svg.lucide-plus)").first();
check("quantity increase control present", (await plus.count()) > 0);
const plusDisabled = (await plus.count()) ? await plus.isDisabled().catch(() => null) : null;
if (plusDisabled === false) {
  await plus.click();
  await page.waitForTimeout(1800);
  const sub2 = await priceOf();
  const qty2 = await qtyOf();
  check("quantity increase updates subtotal", sub2 != null && sub1 != null && sub2 > sub1, `${sub1} → ${sub2}`);
  check("quantity increase updates item count", qty2 === (qty1 ?? 0) + 1, `${qty1} → ${qty2}`);

  const minus = page.locator("main button:has(svg.lucide-minus)").first();
  check("quantity decrease control present", (await minus.count()) > 0);
  if (await minus.count()) {
    await minus.click();
    await page.waitForTimeout(1800);
    const sub3 = await priceOf();
    check("quantity decrease restores subtotal", sub3 === sub1, `${sub2} → ${sub3} (expected ${sub1})`);
  }
} else {
  // correctly disabled at the stock ceiling — assert the cap, don't fail
  R.quantityPlusDisabledAtStockCap = true;
  check("quantity increase correctly capped by available stock", plusDisabled === true, `disabled=${plusDisabled}`);
  const minus0 = page.locator("main button:has(svg.lucide-minus)").first();
  if (await minus0.count()) {
    await minus0.click();
    await page.waitForTimeout(1800);
    const subB = await priceOf();
    check("quantity decrease reduces subtotal", subB != null && sub1 != null && subB < sub1, `${sub1} → ${subB}`);
    await page.locator("main button:has(svg.lucide-plus)").first().click().catch(() => {});
    await page.waitForTimeout(1800);
    const subC = await priceOf();
    check("quantity increase restores subtotal", subC === sub1, `${subB} → ${subC} (expected ${sub1})`);
  }
}

cart = await mainText();
check("cart shows Delivery Free (config fee ₹0)", /Delivery\s+Free/i.test(cart), cart.slice(0, 220));
const cartTotal = (/Total[^₹]*₹([\d,]+)/.exec(cart) || [])[1];
R.cartTotals = { sub1, cartTotal, text: cart.slice(0, 260) };
check("cart total = subtotal (fee ₹0)", cartTotal != null && Number(cartTotal.replace(/,/g, "")) === sub1, `total=${cartTotal} subtotal=${sub1}`);
await page.screenshot({ path: "/tmp/qa-23-cart.png" });

// remove item
const delBtns = page.locator('main button[aria-label*="emove" i], main button:has(svg.lucide-trash2)');
const delCount = await delBtns.count();
check("remove control present", delCount >= 1, `count=${delCount}`);
if (delCount >= 1) {
  await delBtns.first().click().catch(() => {});
  await page.waitForTimeout(2000);
  t = await toasts();
  R.cartRemoveToast = t;
  cart = await mainText();
  check("item removed → empty cart state", /Cart is Empty/i.test(cart), cart.slice(0, 120));
}

// add again and proceed to checkout (leave the cart populated)
await go(page, `#/products/${p1.slug}`);
await page.locator("button", { hasText: /^Add to Cart$/ }).first().click();
await page.waitForTimeout(1800);
await go(page, "#/cart");
cart = await mainText();
check("re-add restores the cart item", new RegExp(key1, "i").test(cart), cart.slice(0, 140));
await page.locator("button", { hasText: /Proceed to Checkout/i }).first().click();
await page.waitForTimeout(2200);
check("Cart → Checkout navigates", /^\/checkout/.test(hash(page)), hash(page));
check("still authenticated in checkout (no /auth bounce)", !/^\/auth/.test(hash(page)), hash(page));
R.checkoutLanding = await pageSummary(page);

R.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 8);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 23: addresses precision + wishlist + cart (authenticated)", R);
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL WISHLIST/CART CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);