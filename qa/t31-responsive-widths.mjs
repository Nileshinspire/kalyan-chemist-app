// Phase M: responsive QA across the required mobile widths + desktop sanity pass.
// Run: node qa/t31-responsive-widths.mjs
//
// Exit codes: 0 = all checks pass · 1 = failures · 78 = preview unavailable (env).
import { launch, go, report, interesting, assertPreview } from "./harness.mjs";
import { anonymousSignIn, injectSession } from "./authSession.mjs";

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

/** Fast navigation for the width sweep (layout is CSS-driven; 700ms settles it). */
const nav = async (page, hash, ms = 700) => {
  await page.goto(`${"https://sunny-baths-help.freebuff.dev"}/${hash}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(ms);
};

/** In-page overflow measurement + clipped-text/image scan. */
const layout = (pg = page) =>
  pg.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 2 || r.left < -2) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed") continue;
        // Ignore anything an ancestor clips or scrolls (overflow hidden/clip/
        // auto/scroll): those elements are not visible outside the viewport and
        // do not create page overflow — e.g. decorative background orbs.
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) {
          const pcs = getComputedStyle(p);
          if (/(hidden|clip|auto|scroll)/.test(pcs.overflowX)) { clipped = true; break; }
          p = p.parentElement;
        }
        if (clipped) continue;
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
    // line-clamp / truncate handling.
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

// injectSession can race an in-flight navigation on first load — retry briefly.
const injectSafe = async () => {
  for (let i = 0; i < 3; i++) {
    try { await injectSession(page, session); return; }
    catch { await page.waitForTimeout(900); }
  }
  throw new Error("injectSession failed after retries");
};

// One browser for the whole mobile sweep; resize the viewport per width.
// Session lives in localStorage, so a single injection covers every width.
const { browser, page, consoleErrors, pageErrors } = await launch({ mobile: true });
await nav(page, "#/", 1200);
await injectSafe();

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 844 });
  await nav(page, "#/");

  const perWidth = {};
  for (const [route, label] of ROUTES) {
    await nav(page, `#${route}`);
    const l = await layout();
    perWidth[route] = { scrollWidth: l.scrollWidth, vw: l.vw, overflow: l.overflow };
    check(`[${width}px] ${label}: no horizontal page overflow`, l.scrollWidth <= l.vw + 2, `scrollW=${l.scrollWidth} vw=${l.vw}`);
    check(`[${width}px] ${label}: no elements outside viewport`, l.overflow.length === 0, JSON.stringify(l.overflow));
    check(`[${width}px] ${label}: no clipped text`, l.clipped.length === 0, JSON.stringify(l.clipped));
    check(`[${width}px] ${label}: no broken images`, l.brokenImages.length === 0, JSON.stringify(l.brokenImages));
  }

  // Product detail (needs a real product) + its CTA row.
  await nav(page, "#/products");
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
    // Search reachable from the header on an inner page (visible instance only:
    // the desktop nav search exists in the DOM but is display:none on mobile).
    await nav(page, "#/products");
    const search = page.locator("header input[placeholder*='Search']").locator("visible=true").first();
    const sc = await search.count();
    check(`[${width}px] Header search visible on inner pages`, sc > 0 && await search.isVisible(), `count=${sc}`);
    if (sc) {
      const sb = await search.boundingBox();
      check(`[${width}px] Header search spans most of the width`, !!sb && sb.width >= width * 0.6, JSON.stringify(sb && { w: Math.round(sb.width) }));
    }
  }

  // Cart — verify the row layout stays inside the viewport.
  await nav(page, "#/cart");
  const cartL = await layout();
  check(`[${width}px] Cart: no horizontal overflow`, cartL.scrollWidth <= cartL.vw + 2, `scrollW=${cartL.scrollWidth}`);

  R.widths[width] = perWidth;
  R[`console_${width}`] = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(-5);
  R[`pageErrors_${width}`] = [...pageErrors];
}
await browser.close();

// ── Desktop sanity pass (1440): the desktop layout must stay healthy ──
{
  const { browser: dB, page: dPage } = await launch();
  await go(dPage, "#/");
  for (const [route, label] of ROUTES) {
    await go(dPage, `#${route}`);
    const l = await layout(dPage);
    check(`[1440px] ${label}: no horizontal overflow`, l.scrollWidth <= l.vw + 2, `scrollW=${l.scrollWidth} vw=${l.vw}`);
    check(`[1440px] ${label}: no elements outside viewport`, l.overflow.length === 0, JSON.stringify(l.overflow));
  }
  await dB.close();
}

report("Test 31: multi-width responsive QA (320/375/390/430 + 1440)", { counts: { checks: R.checks.length, failures: R.failures.length }, failures: R.failures });
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
if (R.failures.length) process.exit(1);
