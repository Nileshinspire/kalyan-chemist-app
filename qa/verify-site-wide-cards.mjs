// Site-wide verification of discount-badge removal + single-% pricing.
// For every route, at desktop and mobile widths:
//   1. no leaf text containing "%" may sit over/above any media/image box
//   2. every product card may contain AT MOST one "%"-bearing leaf in its
//      pricing area (below the image)
//   3. product detail page: at most one "%" leaf in the price block
// Usage: node qa/verify-site-wide-cards.mjs
import { launch, go, assertPreview, report, interesting } from "./harness.mjs";

await assertPreview();

// A product slug for the detail-page check (first hot seller).
const probe = () => {
  const pctLeafs = [...document.querySelectorAll("*")].filter(
    (el) => el.children.length === 0 && /%/.test(el.textContent || "")
  );
  const violations = [];

  // (1) any "%" leaf positioned over an image/media box
  const mediaBoxes = [...document.querySelectorAll("img")].map((img) => {
    const host = img.closest("div[class*='aspect-square'], div[class*='relative flex'], div[class*='h-28'], div[class*='h-40']") || img.parentElement;
    return { img, box: host?.getBoundingClientRect() };
  });
  for (const leaf of pctLeafs) {
    const t = (leaf.textContent || "").trim();
    if (!/\d/.test(t)) continue; // skip CSS/style nodes without digits
    const r = leaf.getBoundingClientRect();
    if (r.width === 0) continue;
    for (const { box } of mediaBoxes) {
      if (!box) continue;
      // leaf vertically starts above the media bottom AND horizontally inside it
      if (r.top < box.bottom - 4 && r.bottom > box.top && r.left < box.right && r.right > box.left) {
        // below-media price text can overlap a tall ancestor box; require the
        // leaf's vertical center to be inside the media box to count as "over"
        const cy = (r.top + r.bottom) / 2;
        if (cy > box.top && cy < box.bottom) {
          violations.push({ type: "pct-over-image", text: t.slice(0, 20), cls: (leaf.className?.baseVal ?? leaf.className ?? "").toString().slice(0, 50) });
        }
      }
    }
  }

  // (2) per-card % counts (cards = data-slot=card + any div with h3 + Add/Buy button)
  const isCard = (el) => {
    if (el.getAttribute?.("data-slot") === "card") return true;
    if (!el.querySelector(":scope > h3, :scope > div > h3")) return false;
    const btns = [...el.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
    return btns.some((t) => /^(add|add to cart|buy now|cart|sold out|out of stock|move to cart)$/i.test(t));
  };
  const cards = [...document.querySelectorAll("div")].filter((el) => isCard(el) && ![...el.querySelectorAll("div")].some((d) => d !== el && isCard(d) && d.querySelector("h3") === el.querySelector("h3")));
  const cardReports = [];
  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    if (rect.width < 80) continue;
    const pcts = [...card.querySelectorAll("*")]
      .filter((el) => el.children.length === 0 && /\d\s*%/.test(el.textContent || ""))
      .map((el) => (el.textContent || "").trim().slice(0, 16));
    cardReports.push({ name: (card.querySelector("h3")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24), pctCount: pcts.length, pcts });
    if (pcts.length > 1) violations.push({ type: "duplicate-pct-in-card", name: cardReports.at(-1).name, pcts });
  }

  // (3) page-level: total % leaves that look like discount text
  const discountPcts = pctLeafs
    .map((el) => (el.textContent || "").trim())
    .filter((t) => /\d{1,3}\s*%/.test(t) && !/keyframes|animation|tailwindcss|sonner/i.test(t));

  return {
    route: location.hash,
    vw: innerWidth,
    violations,
    cardsChecked: cardReports.length,
    cardsWithPct: cardReports.filter((c) => c.pctCount > 0),
    discountPctTextsOnPage: discountPcts.slice(0, 12),
  };
};

const routes = ["#/", "#/products", "#/products?search=dolo", "#/products?category=pain-relief", "#/value-deals", "#/hot-sellers", "#/wishlist", "#/cart"];
const { browser, context, page, pageErrors, consoleErrors } = await launch();

// find a product slug for the detail page
await go(page, "#/products");
await page.waitForTimeout(3500);
const slug = await page.evaluate(() => {
  const el = [...document.querySelectorAll("a[href*='/products/'], [data-slot='card']")][0];
  const href = el?.getAttribute?.("href") || "";
  const m = href.match(/\/products\/([^/?#]+)/);
  if (m) return m[1];
  return null;
});
if (slug) routes.push(`#/products/${slug}`);

const results = {};
for (const r of routes) {
  await go(page, r);
  await page.waitForTimeout(3800);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((res) => setTimeout(res, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
  results[r] = await page.evaluate(probe);
}
report("DESKTOP site-wide", results);

// Mobile sweep of the same routes
const mob = await launch({ mobile: true });
const mobResults = {};
for (const r of routes) {
  await go(mob.page, r);
  await mob.page.waitForTimeout(3200);
  await mob.page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((res) => setTimeout(res, 90));
    }
    window.scrollTo(0, 0);
  });
  await mob.page.waitForTimeout(900);
  mobResults[r] = await mob.page.evaluate(probe);
}
report("MOBILE site-wide", mobResults);

const allViolations = [
  ...Object.entries(results).flatMap(([r, v]) => v.violations.map((x) => ({ ...x, route: r, vw: "desktop" }))),
  ...Object.entries(mobResults).flatMap(([r, v]) => v.violations.map((x) => ({ ...x, route: r, vw: "mobile" }))),
];
console.log("\n===== TOTAL VIOLATIONS =====");
console.log(JSON.stringify(allViolations, null, 2));
console.log("pageErrors:", interesting(pageErrors).slice(0, 5));
console.log("consoleErrors:", interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|403|favicon/i.test(e)).slice(0, 5));
await browser.close();
await mob.browser.close();
process.exit(allViolations.length > 0 ? 1 : 0);
