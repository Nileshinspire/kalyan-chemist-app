// Phase 2 + 11: sweep every customer-facing route and exercise the main
// detail journeys (product / lab test / doctor), plus product-image safety.
// Run: node qa/t27-routes-journeys.mjs
import { launch, BASE, report, interesting, assertPreview, EXIT_ENV_BLOCKED } from "./harness.mjs";
import { pageSummary, hash, anonymousSignIn, injectSession } from "./authSession.mjs";

await assertPreview();

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

// Fast in-app navigation with the same signature as the harness `go()`.
// The harness version does a full page.goto per route (27 routes × bundle
// re-download + Convex reconnect), which overruns the 180s command cap.
// Hash changes keep the SPA — and the injected auth session — alive.
// NOTE: must be declared before its first call below (TDZ).
const go = async (page, hashTarget) => {
  const target = hashTarget.startsWith("#") ? hashTarget : `#${hashTarget}`;
  const url = page.url();
  if (!url.startsWith(BASE)) {
    await page.goto(`${BASE}/${target}`, { waitUntil: "domcontentloaded" });
  } else if (`#${url.split("#")[1] || "/"}` !== target) {
    await page.evaluate((t) => { window.location.hash = t; }, target);
  }
  await page
    .waitForFunction(() => document.body.innerText.length > 400, null, { timeout: 7000 })
    .catch(() => {});
  await page.waitForTimeout(1000);
};

// Several customer routes (upload-prescription, refill, lab tests, wishlist,
// chatbot, doctor appointment) are auth-gated; sweep them as a signed-in user.
const session = await anonymousSignIn();
await go(page, "#/");
for (let i = 0; i < 3; i++) {
  try { await injectSession(page, session); break; } catch { await page.waitForTimeout(900); }
}
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};

const NOISY = /pngtree|wikimedia|mankind|web-share|403|422/i;
const snapshot = async (route) => {
  const s = await pageSummary(page);
  return {
    route,
    h1: s.h1.join(" | "),
    h2: s.h2.join(" | "),
    mainLen: s.mainLen,
    bodyLen: s.bodyLen,
    buttons: s.buttons.slice(0, 6),
    breadcrumb: s.breadcrumb,
  };
};

// ── Public routes every customer can reach ──
const PUBLIC_ROUTES = [
  ["/", "Home"],
  ["/products", "Products"],
  ["/categories", "Categories"],
  ["/brands", "Brands"],
  ["/value-deals", "Deals"],
  ["/hot-sellers", "Hot sellers"],
  ["/upload-prescription", "Upload prescription"],
  ["/doctor-appointment", "Doctor appointment"],
  ["/refill", "Refill"],
  ["/lab-tests", "Lab tests"],
  ["/cart", "Cart"],
  ["/wishlist", "Wishlist"],
  ["/about-us", "About"],
  ["/contact-us", "Contact"],
  ["/faqs", "FAQs"],
  ["/why-choose-us", "Why choose us"],
  ["/privacy-policy", "Privacy"],
  ["/terms-conditions", "Terms"],
  ["/shipping-delivery", "Shipping"],
  ["/cancellation-refund", "Refund"],
  ["/return-policy", "Returns"],
  ["/prescription-policy", "Rx policy"],
  ["/payment-policy", "Payment policy"],
  ["/disclaimer", "Disclaimer"],
  ["/sitemap", "Sitemap"],
  ["/careers", "Careers"],
  ["/chatbot", "Chatbot"],
];

R.routes = [];
for (const [route, label] of PUBLIC_ROUTES) {
  const before = pageErrors.length;
  await go(page, `#${route}`);
  const snap = await snapshot(route);
  R.routes.push(snap);
  const crashed = pageErrors.length > before;
  check(`${label}: renders content`, snap.bodyLen > 400, `body=${snap.bodyLen} h1=${snap.h1.slice(0, 60)}`);
  check(`${label}: no page crash`, !crashed, crashed ? pageErrors[pageErrors.length - 1] : "ok");
}

// ── Product detail journey (listing → detail → breadcrumb) ──
await go(page, "#/products");
const prodCard = page.locator("main [data-slot='card'], main a[href*='/products/']").filter({ hasText: /₹/ }).first();
check("products listing shows cards", (await prodCard.count()) > 0);
await prodCard.click().catch(() => {});
await page.waitForTimeout(2200);
R.productDetail = await snapshot("product-detail");
check("product detail opens from listing", /\/products\//.test(hash(page)), hash(page));
check("product detail renders product h1", R.productDetail.h1.length > 0 && R.productDetail.h1 !== "Products", R.productDetail.h1);
check("product breadcrumb present", !!R.productDetail.breadcrumb, String(R.productDetail.breadcrumb));

// image safety on the detail page
R.productImages = await page.evaluate(() =>
  [...document.querySelectorAll("main img")].slice(0, 8).map((i) => ({
    src: (i.currentSrc || i.src).slice(-70),
    ok: i.complete && i.naturalWidth > 0,
    alt: i.alt,
  }))
);
const realImgs = R.productImages.filter((i) => /^https?:|^\/|^\./.test(i.src) && !/placeholder|sprite/i.test(i.src));
check("product detail has no broken images", realImgs.every((i) => i.ok), JSON.stringify(realImgs.filter((i) => !i.ok)));

// change product → image must change (no stale A-on-B)
const firstSrc = realImgs[0]?.src || null;
await go(page, "#/products");
const cards = page.locator("main [data-slot='card'], main a[href*='/products/']").filter({ hasText: /₹/ });
const nCards = await cards.count();
if (nCards >= 2 && firstSrc) {
  await cards.nth(Math.min(1, nCards - 1)).click().catch(() => {});
  await page.waitForTimeout(2200);
  const second = await page.evaluate(() => [...document.querySelectorAll("main img")].slice(0, 8).map((i) => (i.currentSrc || i.src).slice(-70)));
  R.secondProductImages = second;
  check("changing product changes rendered images (no stale image)", JSON.stringify(second) !== JSON.stringify(R.productImages.map((i) => i.src)), `first=${firstSrc} second=${second[0]}`);
}

// ── Category → products (search-param nav) ──
await go(page, "#/categories");
const catCard = page.locator("main a[href*='category'], main [data-slot='card'], main a").filter({ hasText: /[A-Za-z]/ }).nth(1);
await catCard.click().catch(() => {});
await page.waitForTimeout(2200);
R.categoryFlow = await snapshot("category-flow");
check("category navigates to a listing", /\/(products|categories)/.test(hash(page)), hash(page));
check("category flow shows products", /₹/.test(await page.evaluate(() => document.body.innerText)), hash(page));

// ── Lab tests → detail ──
await go(page, "#/lab-tests");
const testCard = page.locator("main a[href*='lab-tests'], main [data-slot='card']").first();
await testCard.waitFor({ state: "visible", timeout: 9000 }).catch(() => {});
check("lab tests listing renders", (await testCard.count()) > 0);
await testCard.click().catch(() => {});
await page.waitForTimeout(2200);
R.labDetail = await snapshot("lab-detail");
check("lab test detail reachable", /lab-tests/.test(hash(page)), hash(page));
check("lab detail renders content", R.labDetail.bodyLen > 400, `body=${R.labDetail.bodyLen} h1=${R.labDetail.h1.slice(0, 60)}`);

// ── Doctor appointment → detail ──
await go(page, "#/doctor-appointment");
const docCard = page.locator("main a[href*='doctors/'], main [data-slot='card']").first();
await docCard.waitFor({ state: "visible", timeout: 9000 }).catch(() => {});
check("doctor listing renders", (await docCard.count()) > 0);
await docCard.click().catch(() => {});
await page.waitForTimeout(2200);
R.docDetail = await snapshot("doctor-detail");
check("doctor detail reachable", /doctors\//.test(hash(page)), hash(page));
check("doctor detail renders content", R.docDetail.bodyLen > 400, `body=${R.docDetail.bodyLen} h1=${R.docDetail.h1.slice(0, 60)}`);

// ── Medicine refill + upload prescription render ──
await go(page, "#/upload-prescription");
R.uploadRx = await snapshot("upload-prescription");
check("upload prescription renders a form/CTA", R.uploadRx.buttons.length > 0 || /upload/i.test(R.uploadRx.h1), R.uploadRx.h1 || R.uploadRx.buttons.join("|"));

await go(page, "#/refill");
R.refill = await snapshot("refill");
check("medicine refill renders", R.refill.bodyLen > 400, `body=${R.refill.bodyLen}`);

R.consoleErrors = interesting(consoleErrors).filter((e) => !NOISY.test(e)).slice(0, 10);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !NOISY.test(r)).slice(0, 8);

report("Test 27: customer route sweep + detail journeys + image safety", R);
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL ROUTE/JOURNEY CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);