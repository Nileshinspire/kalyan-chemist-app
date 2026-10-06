// Phase M: responsive QA across the required mobile widths + desktop sanity pass.
// Run: node qa/t31-responsive-widths.mjs
//
// Exit codes: 0 = all checks pass · 1 = failures · 78 = preview unavailable (env).
import { launch, go, report, interesting, assertPreview } from "./harness.mjs";
import { anonymousSignIn, injectSession, hash, pageSummary } from "./authSession.mjs";

await assertPreview();

const WIDTHS = [320, 375, 390, 430];
const ROUTES = [
  ["/", "Home"],
  ["/products", "Products"],
  ["/categories", "Categories"],
  ["/brands", "Brands"],
  ["/cart", "Cart"],
  ["/checkout", "Checkout"],
  ["/upload-prescription", "Upload Rx"],
  ["/lab-tests", "Lab tests"],
  ["/doctor-appointment", "Doctors"],
  ["/refill", "Refill"],
  ["/account", "Account"],
  ["/account/addresses", "Addresses"],
  ["/account/orders", "My orders"],
  ["/account/wishlist", "Wishlist"],
  ["/wishlist", "Wishlist (standalone)"],
  ["/auth", "Auth"],
  ["/about-us", "About"],
  ["/contact-us", "Contact"],
  ["/faqs", "FAQs"],
];

const R = { checks: [], failures: [], widths: {} };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};

/** In-page overflow measurement + tap-target scan. */
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
        // Ignore children of intentionally horizontally-scrollable rails.
        let p = el.parentElement, scrollable = false;
        while (p && p !== document.body) {
          const pcs = getComputedStyle(p);
          if (/auto|scroll/.test(pcs.overflowX) && p.scrollWidth > p.clientWidth + 2) { scrollable = true; break; }
          p = p.parentElement;
        }
        if (scrollable) continue;
        over.push({
          tag: el.tagName,
          cls: String(el.className || "").slice(0, 70),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
      if (over.length >= 6) break;
    }
    // Cut-off content: elements whose text is clipped without an intentional
    // line-clamp / nowrap handling.
    const clipped = [];
    for (const el of document.querySelectorAll("main h1, main h2, main h3, main p, main button, main a")) {
      if (clipped.length >= 5) break;
      const cs = getComputedStyle(el);
      if (cs.overflow === "hidden" && cs.textOverflow === "ellipsis" && !/line-clamp|truncate/.test(String(el.className))) {
        if (el.scrollWidth > el.clientWidth + 4) {
          clipped.push({ tag: el.tagName, txt: (el.innerText || "").replace(/\s+/g, " ").slice(0, 40) });
        }
      }
    }
    return {
      vw,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: over,
      clipped,
      h1: [...document.querySelectorAll("h1")].map((e) => e.innerText.trim()).slice(0, 2),
      brokenImages: [...document.images]
        .filter((i) => i.complete && i.naturalWidth === 0 && !/pngtree|wikimedia|mankind|placeholder/i.test(i.src))
        .map((i) => (i.currentSrc || i.src).slice(-70))
        .slice(0, 4),
    };
  });

const session = await anonymousSignIn();

for (const width of WIDTHS) {
  const { browser, context, page, consoleErrors, pageErrors } = await launch({ mobile: true });
  await context.setViewportSize({ width, height: 844 });
  await go(page, "#/");
  await injectSession(page, session);

  const perWidth = {};
  for (const [route, label] of ROUTES) {
    await go(page, `#${route}`);
    const l = await layout();
    perWidth[route] = { scrollWidth: l.scrollWidth, vw: l.vw, overflow: l.overflow };
    check(`[${width}px] ${label}: no horizontal page overflow`, l.scrollWidth <= l.vw + 2, `scrollW=${l.scrollWidth} vw=${l.vw}`);
    check(`[${width}px] ${label}: no elements outside viewport`, l.overflow.length === 0, JSON.stringify(l.overflow));
    check(`[${width}px] ${label}: no clipped text`, l.clipped.length === 0, JSON.stringify(l.clipped));
    check(`[${width}px] ${label}: no broken images`, l.brokenImages.length === 0, JSON.stringify(l.brokenImages));
  }

  // Product detail (needs a real product) + its CTA row.
  await go(page, "#/products");
  const cards = page.locator("main [data-slot='card']").filter({ hasText: /₹/ });
  if (await cards.count()) {
    await cards.first().click().catch(() => {});
    await page.waitForTimeout(2200);
    const pd = await layout();
    perWidth["/products/:slug"] = { scrollWidth: pd.scrollWidth, vw: pd.vw, overflow: pd.overflow };
    check(`[${width}px] Product detail: no horizontal overflow`, pd.scrollWidth <= pd.vw + 2, `scrollW=${pd.scrollWidth} vw=${pd.vw}`);
    check(`[${width}px] Product detail: no elements outside viewport`, pd.overflow.length === 0, JSON.stringify(pd.overflow));

    const buy = page.getByRole("button", { name: /Buy Now/i }).first();
    const add = page.getByRole("button", { name: /Add to Cart|Out of Stock/i }).first();
    for (const [nm, loc] of [["Buy Now", buy], ["Add to Cart", add]]) {
      const c = await loc.count();
      check(`[${width}px] Product detail: ${nm} present`, c > 0, `count=${c}`);
      if (c) {
        const b = await loc.boundingBox();
        check(
          `[${width}px] Product detail: ${nm} fully inside viewport`,
          !!b && b.x >= -1 && b.x + b.width <= width + 1,
          JSON.stringify(b && { x: Math.round(b.x), w: Math.round(b.width) })
        );
        check(`[${width}px] Product detail: ${nm} tap target >= 32px tall`, !!b && b.height >= 32, JSON.stringify(b && { h: Math.round(b.height) }));
      }
    }
    // Search reachable from the header on an inner page.
    await go(page, "#/products");
    const search = page.locator("header input[placeholder*='Search']").first();
    check(`[${width}px] Header search visible on inner pages`, (await search.count()) > 0 && await search.isVisible(), `count=${await search.count()}`);
    if (await search.count()) {
      const sb = await search.boundingBox();
      check(`[${width}px] Header search spans most of the width`, !!sb && sb.width >= width * 0.6, JSON.stringify(sb && { w: Math.round(sb.width) }));
    }
  }

  // Cart with an item (if any) — verify the row layout.
  await go(page, "#/cart");
  const cartL = await layout();
  check(`[${width}px] Cart: no horizontal overflow`, cartL.scrollWidth <= cartL.vw + 2, `scrollW=${cartL.scrollWidth}`);

  R.widths[width] = perWidth;
  R[`console_${width}`] = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 5);
  R[`pageErrors_${width}`] = pageErrors;
  await browser.close();
}

// ── Desktop sanity pass (1440): the desktop layout must stay healthy ──
{
  const { browser, page } = await launch();
  await go(page, "#/");
  for (const [route, label] of ROUTES) {
    await go(page, `#${route}`);
    const l = await layout();
    check(`[1440px] ${label}: no horizontal overflow`, l.scrollWidth <= l.vw + 2, `scrollW=${l.scrollWidth} vw=${l.vw}`);
    check(`[1440px] ${label}: no elements outside viewport`, l.overflow.length === 0, JSON.stringify(l.overflow));
  }
  await browser.close();
}

report("Test 31: multi-width responsive QA (320/375/390/430 + 1440)", R);
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
if (R.failures.length) process.exit(1);
