// Phase L: responsive customer QA at a mobile viewport (390x844).
// Run: node qa/t30-mobile.mjs
import { launch, go, report, interesting, assertPreview } from "./harness.mjs";
import { anonymousSignIn, injectSession, hash, pageSummary } from "./authSession.mjs";

await assertPreview();

const { browser, context, page, consoleErrors, pageErrors, badResponses } = await launch({ mobile: true });
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};

// Measure horizontal overflow + elements sticking out of the viewport.
const layout = () =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 2 || r.left < -2) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed") continue;
        over.push({
          tag: el.tagName,
          cls: String(el.className || "").slice(0, 60),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
      if (over.length >= 6) break;
    }
    return {
      vw,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflow: over,
      h1: [...document.querySelectorAll("h1")].map((e) => e.innerText.trim()).slice(0, 2),
      smallTargets: [...document.querySelectorAll("main button, main a")]
        .map((e) => ({ t: (e.innerText || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 28), r: Math.round(Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height)) }))
        .filter((x) => x.t && x.r > 0 && x.r < 24)
        .slice(0, 6),
    };
  });

const session = await anonymousSignIn();
await go(page, "#/");
await injectSession(page, session);

const PAGES = [
  ["/", "Home"],
  ["/products", "Products"],
  ["/categories", "Categories"],
  ["/brands", "Brands"],
  ["/cart", "Cart"],
  ["/upload-prescription", "Upload Rx"],
  ["/lab-tests", "Lab tests"],
  ["/doctor-appointment", "Doctors"],
  ["/refill", "Refill"],
  ["/account", "Account"],
  ["/account/addresses", "Addresses"],
  ["/account/orders", "My orders"],
  ["/account/wishlist", "Wishlist"],
];

R.layouts = {};
for (const [route, label] of PAGES) {
  await go(page, `#${route}`);
  const l = await layout();
  R.layouts[route] = { vw: l.vw, scrollWidth: l.scrollWidth, overflow: l.overflow, h1: l.h1 };
  check(`${label}: no horizontal page overflow`, l.scrollWidth <= l.vw + 2, `scrollW=${l.scrollWidth} vw=${l.vw}`);
  check(`${label}: no elements overflowing viewport`, l.overflow.length === 0, JSON.stringify(l.overflow));
}

// ── Product cards are usable on mobile ──
await go(page, "#/products");
const cards = page.locator("main [data-slot='card']").filter({ hasText: /₹/ });
check("mobile product listing shows cards", (await cards.count()) > 0, `count=${await cards.count()}`);
if (await cards.count()) {
  const box = await cards.first().boundingBox();
  check("first card fits within the viewport", !!box && box.width > 100 && box.width <= 390, JSON.stringify(box && { w: Math.round(box.width), x: Math.round(box.x) }));
  await cards.first().click().catch(() => {});
  await page.waitForTimeout(2200);
  check("tapping a card opens the product", /\/products\//.test(hash(page)), hash(page));
}

// ── Product detail on mobile ──
const pd = await layout();
R.detailLayout = pd;
check("product detail: no horizontal overflow", pd.scrollWidth <= pd.vw + 2, `scrollW=${pd.scrollWidth}`);
const addBtn = page.locator("main button", { hasText: /Add to Cart/i }).first();
check("product detail: Add to Cart reachable on mobile", (await addBtn.count()) > 0);
if (await addBtn.count()) {
  const bb = await addBtn.boundingBox();
  check("Add to Cart is a comfortable tap target", !!bb && bb.height >= 32, JSON.stringify(bb && { h: Math.round(bb.height), w: Math.round(bb.width) }));
}

// ── Cart on mobile ──
await go(page, "#/cart");
const cartL = await layout();
R.cartLayout = cartL;
check("cart: no horizontal overflow", cartL.scrollWidth <= cartL.vw + 2, `scrollW=${cartL.scrollWidth}`);
check("cart renders (empty or populated)", cartL.h1.length > 0 || (await pageSummary(page)).mainLen > 0, JSON.stringify(cartL.h1));

// ── Checkout on mobile ──
await go(page, "#/checkout");
const coL = await layout();
R.checkoutLayout = coL;
check("checkout: no horizontal overflow", coL.scrollWidth <= coL.vw + 2, `scrollW=${coL.scrollWidth}`);
const coSum = await pageSummary(page);
check("checkout renders on mobile", /Checkout|Address/i.test(coSum.h1.join(" ") + coSum.mainHead), coSum.mainHead.slice(0, 90));

// ── Breadcrumbs on mobile ──
await go(page, "#/products");
const c0 = page.locator("main [data-slot='card']").filter({ hasText: /₹/ }).first();
if (await c0.count()) {
  await c0.click().catch(() => {});
  await page.waitForTimeout(2000);
  const bc = page.locator("nav[aria-label='Breadcrumb']");
  check("breadcrumb renders on mobile", (await bc.count()) > 0);
  if (await bc.count()) {
    const bbx = await bc.boundingBox();
    check("breadcrumb is not clipped off-screen", !!bbx && bbx.x >= -2 && bbx.width > 50, JSON.stringify(bbx && { x: Math.round(bbx.x), w: Math.round(bbx.width) }));
    const bcL = await layout();
    check("breadcrumb does not cause horizontal overflow", bcL.scrollWidth <= bcL.vw + 2, `scrollW=${bcL.scrollWidth}`);
  }
}

// ── Dialog / modal usability (address form) ──
await go(page, "#/account/addresses");
const addAddr = page.locator("button", { hasText: /^(Add|Add Your First) Address$/i }).first();
if (await addAddr.count()) {
  await addAddr.click().catch(() => {});
  await page.waitForTimeout(1200);
  const dlg = page.locator('[role="dialog"]');
  const dlgCount = await dlg.count();
  R.dialogCount = dlgCount;
  check("address dialog opens on mobile", dlgCount > 0);
  if (dlgCount) {
    const db = await dlg.first().boundingBox();
    check("dialog fits inside the viewport", !!db && db.width <= 390 && db.x >= -2, JSON.stringify(db && { w: Math.round(db.width), x: Math.round(db.x) }));
    const dl = await layout();
    check("dialog does not create page overflow", dl.scrollWidth <= dl.vw + 2, `scrollW=${dl.scrollWidth}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    check("dialog closes with Escape", (await page.locator('[role="dialog"]').count()) === 0, `count=${await page.locator('[role="dialog"]').count()}`);
  }
}

// ── Small tap targets (report-only signal, fail only when truly unusable) ──
await go(page, "#/account");
const accL = await layout();
R.accountSmallTargets = accL.smallTargets;
check("account: no horizontal overflow", accL.scrollWidth <= accL.vw + 2, `scrollW=${accL.scrollWidth}`);

R.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 8);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 30: mobile responsive customer QA", R);
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL MOBILE CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);