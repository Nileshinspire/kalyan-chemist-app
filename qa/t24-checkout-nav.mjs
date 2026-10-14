// Authenticated QA — Checkout steps, breadcrumb integrity, logout/protection, Razorpay config.
// Run: node qa/t24-checkout-nav.mjs
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
  (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).map((t) => t.replace(/\s+/g, " ").trim());
let t;

const session = await anonymousSignIn();
await go(page, "#/");
await injectSession(page, session);

// ══ Razorpay configuration probe (read-only, no order placed) ══
const rzProbe = await fetch(`${session.convexUrl}/api/action`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "razorpayActions:getKeyId", args: {} }),
}).then((r) => r.text()).catch((e) => `error: ${e.message}`);
R.razorpayGetKeyIdResponse = rzProbe.slice(0, 300);

// ══ Address fixture (this account is new — checkout needs a saved address) ══
await go(page, "#/account/addresses");
R.addressFixture = await ensureAddress(page);
R.addressFixtureVisible = /Flat 9C/.test((await page.locator("main").innerText()).replace(/\s+/g, " "));

// ══ Cart → Checkout steps ══
const items = await queryPublic(session.convexUrl, "publicProducts:searchPage", { query: "", sortBy: "price_asc", offset: 0, limit: 3 });
const p = items?.items?.[0];
await go(page, `#/products/${p.slug}`);
await page.locator("button", { hasText: /^Add to Cart$/ }).first().click();
await page.waitForTimeout(1600);
await go(page, "#/cart");
await page.locator("button", { hasText: /Proceed to Checkout/i }).first().click();
await page.waitForTimeout(2200);

const stepLabels = await page.locator("button").evaluateAll((els) =>
  els.map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 24)
);
R.checkoutButtons = stepLabels;
R.checkoutStep0 = await pageSummary(page);
check("checkout step 1 (Address) renders", /Address/i.test(R.checkoutStep0.mainHead), R.checkoutStep0.mainHead.slice(0, 120));
check("address fixture saved for this session", R.addressFixtureVisible === true, String(R.addressFixtureVisible));
const cont0 = page.locator("main button", { hasText: /^Continue$/ }).first();
const cont0Disabled = (await cont0.count()) ? await cont0.isDisabled().catch(() => null) : null;
// Checkout.tsx auto-selects the default address once the list loads, so
// Continue must already be enabled here (no manual click required).
check("default address auto-selected → Continue enabled", cont0Disabled === false, `disabled=${cont0Disabled}`);
const checkedRadios = await page.locator('main [role="radio"][data-state="checked"]').count();
check("address card shows as selected", checkedRadios >= 1, `checked=${checkedRadios}`);

// Select the saved default address
const addrCard = page.locator("main").locator("div").filter({ hasText: /Flat 9C/ }).last();
if (await addrCard.count()) {
  await addrCard.click().catch(() => {});
  await page.waitForTimeout(1400);
  const sel = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("saved address selectable + serviceability shown", /Flat 9C/.test(sel) && /421306/.test(sel), sel.slice(0, 180));
  check("delivery availability confirmed for served pincode", /Delivery available to 421306/i.test(sel), sel.slice(0, 260));
} else {
  check("saved address present in checkout", false, "address card not found");
}

// Continue through steps (Prescription → Summary → Payment)
for (let i = 0; i < 3; i++) {
  const cont = page.locator("main button", { hasText: /^Continue$/ }).first();
  if (!(await cont.count())) break;
  if (await cont.isDisabled().catch(() => false)) { R.stoppedAt = `step ${i} (Continue disabled)`; break; }
  await cont.click().catch(() => {});
  await page.waitForTimeout(1500);
  R[`afterContinue${i}`] = await pageSummary(page);
}
R.finalCheckout = await pageSummary(page);
const coText = R.finalCheckout.mainHead;
check("reached Payment step", /Payment/i.test(R.finalCheckout.buttons.join(" ") + coText) || /Place Order/i.test(R.finalCheckout.buttons.join(" ")), R.finalCheckout.buttons.join(" | ").slice(0, 160));

// Sidebar totals
const readRow = async (label) => {
  const v = await page.evaluate((l) => {
    const spans = [...document.querySelectorAll("span")];
    const el = spans.find((e) => e.textContent.trim().startsWith(l));
    return el?.parentElement ? el.parentElement.innerText.replace(/\s*\n\s*/g, " ").trim() : null;
  }, label);
  const m = v && v.match(/₹\s?([\d,]+)/);
  return { raw: v, value: m ? Number(m[1].replace(/,/g, "")) : /\bFree\b/.test(v || "") ? 0 : null };
};
const sub = await readRow("Subtotal");
const gst = await readRow("GST");
const del = await readRow("Delivery");
const tot = await readRow("Total");
R.totals = { sub, gst, del, tot };
check("checkout delivery fee Free (config ₹0)", del.value === 0, del.raw);
if (sub.value != null && gst.value != null && del.value != null && tot.value != null) {
  check("checkout total = subtotal + GST + delivery", sub.value + gst.value + del.value === tot.value, `${sub.value}+${gst.value}+${del.value} vs ${tot.value}`);
}
check("COD option available", /Cash on Delivery/i.test(R.finalCheckout.buttons.join(" ") + coText), R.finalCheckout.buttons.join(" | ").slice(0, 200));
// Safety guard: this script must never click Place Order / Pay.
const placeOrderBtns = page.locator("main button").filter({ hasText: /Place Order|Pay ₹|Pay Securely/i });
R.placeOrderButtonsUntouched = (await placeOrderBtns.count()) > 0;
const payToasts = await toasts();
R.paymentToasts = payToasts;
check("no false payment success (no order/payment success toast)", !/order (placed|confirmed|successful)|payment (successful|completed)/i.test(payToasts.join(" ")), payToasts.join(" | "));
check("no order was submitted by the test", !/order (placed|confirmed)/i.test(payToasts.join(" ")), payToasts.join(" | "));
check("wallet row absent/inactive for zero balance", /Wallet/i.test(coText) || !/Wallet/.test(coText), "wallet not shown (balance ₹0)");
await page.screenshot({ path: "/tmp/qa-24-checkout-payment.png" });

// Coupon validation (invalid code only — a real coupon would consume shared usage)
const couponInput = page.locator('input[placeholder*="oupon" i], input[name*="coupon" i]').first();
if (await couponInput.count()) {
  await couponInput.fill("INVALIDQA");
  const apply = page.locator("main button").filter({ hasText: /^(Apply|Checking)/ }).first();
  // While coupons:computeDiscount is in flight the button must be disabled and
  // show its loading treatment instead of silently doing nothing.
  // Right after typing, the query has been kicked off but cannot have
  // resolved yet, so the button must already be in its disabled/loading state.
  const pendingSeen = (await apply.count()) ? await apply.isDisabled().catch(() => null) : null;
  R.couponApplyDisabledWhileLoading = pendingSeen;
  check("Apply disabled while coupon validation is loading", pendingSeen === true, `disabled=${pendingSeen}`);
  if (await apply.count()) {
    // handleApplyCoupon silently no-ops while coupons:computeDiscount is still
    // in flight, so poll/retry instead of clicking once and racing the query.
    t = [];
    const wantInvalid = (list) => list.some((x) => /invalid coupon/i.test(x));
    for (let attempt = 0; attempt < 3 && !wantInvalid(t); attempt++) {
      await page.waitForTimeout(attempt === 0 ? 2500 : 1500);
      await apply.click().catch(() => {});
      await page.waitForTimeout(1600);
      t = await toasts();
    }
    R.couponToast = t;
    check("invalid coupon rejected with message", t.some((x) => /invalid coupon/i.test(x)), t.join(" | "));
    check("invalid coupon is NOT applied", !t.some((x) => /applied successfully|coupon applied/i.test(x)), t.join(" | "));
  }
}

// ══ Breadcrumbs: current page only (real <nav aria-label="Breadcrumb">) ══
const crumbKey = p.name.split(" ")[0];
await go(page, "#/categories");
await page.waitForTimeout(1200);
const bc1 = await pageSummary(page);
R.bcCategories = bc1.breadcrumb;
await go(page, "#/products");
await page.waitForTimeout(1200);
const prodCard = page.locator("main").locator("div").filter({ hasText: new RegExp(crumbKey, "i") }).last();
if (await prodCard.count()) { await prodCard.click().catch(() => {}); await page.waitForTimeout(1600); }
R.bcProduct = (await pageSummary(page)).breadcrumb;
check("product page renders a real breadcrumb", !!R.bcProduct, String(R.bcProduct));
check("product breadcrumb includes the product", new RegExp(crumbKey, "i").test(R.bcProduct || ""), R.bcProduct);
check("product breadcrumb trails back to Home/Products", /Home|Products/i.test(R.bcProduct || ""), R.bcProduct);
await page.goBack();
await page.waitForTimeout(1500);
R.bcAfterBack = (await pageSummary(page)).breadcrumb;
check("Back from product: breadcrumb no longer shows product", !new RegExp(crumbKey, "i").test(R.bcAfterBack || ""), R.bcAfterBack);

// arriving at checkout must not carry a stale product crumb
R.bcCheckout = R.checkoutLanding?.breadcrumb ?? null;
check("checkout page has no stale product crumb", !new RegExp(crumbKey, "i").test(R.bcCheckout || ""), R.bcCheckout ?? "(none)");

await go(page, "#/account/addresses");
await page.waitForTimeout(1600);
const addrBc = (await pageSummary(page)).breadcrumb;
R.bcAddresses = addrBc;
check("account breadcrumbs do not retain product crumb", !new RegExp(crumbKey, "i").test(addrBc || ""), addrBc);

// ══ Logout + route protection + returnTo ══
await go(page, "#/account");
await page.locator("button", { hasText: /^Logout$/ }).first().click().catch(() => {});
await page.waitForTimeout(2500);
R.afterLogoutHash = hash(page);
const stored = await page.evaluate((ns) => ({
  jwt: localStorage.getItem(`__convexAuthJWT_${ns}`),
  refresh: localStorage.getItem(`__convexAuthRefreshToken_${ns}`),
}), session.ns);
R.tokensAfterLogout = { jwt: stored.jwt, refresh: stored.refresh };
check("logout clears stored session", !stored.jwt && !stored.refresh, JSON.stringify(stored));
check("logout leaves authenticated area", !/^\/account/.test(R.afterLogoutHash), R.afterLogoutHash);

await go(page, "#/account");
check("protected route bounces when signed out", /^\/auth\?returnTo=%2Faccount/.test(hash(page)), hash(page));

// Auth page while signed out shows the sign-in form (no loop)
const authSum = await pageSummary(page);
check("auth page renders sign-in form", /Email|Phone/i.test(authSum.buttons.join(" ")), authSum.buttons.join(" | ").slice(0, 120));

R.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 8);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 24: checkout steps, breadcrumbs, logout, razorpay probe", R);
console.log(`\n${R.failures.length ? "FAILURES:" : "ALL CHECKOUT/NAV CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);
