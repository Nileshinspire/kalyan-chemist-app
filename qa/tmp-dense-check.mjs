import { chromium } from "playwright-core";
import { BASE, assertPreview } from "./harness.mjs";

await assertPreview();

const browser = await chromium.launch({ args: ["--no-sandbox"] });

const routes = [
  ["home", "#/"],
  ["products", "#/products"],
  ["category", "#/products?category=pain-relief"],
  ["hot-sellers", "#/hot-sellers"],
  ["value-deals", "#/value-deals"],
];

async function measure(width, hash) {
  const context = await browser.newContext(
    width < 700
      ? { viewport: { width, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width, height: 900 } }
  );
  const page = await context.newPage();
  await page.goto(`${BASE}/${hash}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-slot='card']").length > 0,
    { timeout: 25000 }
  );
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-slot='card']")].slice(0, 12);
    const boxes = cards.map((el) => {
      const r = el.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), top: +r.top.toFixed(1), left: +r.left.toFixed(1) };
    });
    const cols = new Set(boxes.map((b) => b.left)).size;
    const buttons = [...document.querySelectorAll("[data-slot='card'] button")]
      .filter((b) => /add to cart|notify me|alert on/i.test(b.textContent || ""))
      .slice(0, 8)
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { text: (b.textContent || "").trim(), h: +r.height.toFixed(1), top: +r.top.toFixed(1) };
      });
    const firstCard = cards[0];
    const plate = firstCard?.querySelector("div[class*='aspect-']");
    const pr = plate?.getBoundingClientRect();
    return {
      cardCount: document.querySelectorAll("[data-slot='card']").length,
      columns: cols,
      card: boxes[0],
      cardHeights: [...new Set(boxes.map((b) => b.h))],
      image: pr ? { w: +pr.width.toFixed(1), h: +pr.height.toFixed(1) } : null,
      buttons,
      buttonHeights: [...new Set(buttons.map((b) => b.h))],
    };
  });
  await context.close();
  return data;
}

const out = {};
for (const [name, hash] of routes) {
  out[`375-${name}`] = await measure(375, hash);
  out[`390-${name}`] = await measure(390, hash);
  out[`767-${name}`] = await measure(767, hash);
  out[`1440-${name}`] = await measure(1440, hash);
}

/* ── Product Details: rating badge bottom-left + expiry bottom-right ── */
async function detailProbe(width) {
  const context = await browser.newContext(
    width < 700
      ? { viewport: { width, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width, height: 900 } }
  );
  const page = await context.newPage();
  await page.goto(`${BASE}/#/products`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("[data-slot='card']").length > 0, { timeout: 25000 });
  await page.waitForTimeout(1200);

  // Pick one card that shows the rating pill and one that does not.
  const picks = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-slot='card']")];
    let rated = null;
    let unrated = null;
    for (const card of cards) {
      const name = card.querySelector("h3")?.textContent?.trim();
      if (!name) continue;
      const hasPill = [...card.querySelectorAll("span")].some((s) =>
        /review|reviews/i.test(s.getAttribute("title") || "")
      );
      if (hasPill && !rated) rated = name;
      if (!hasPill && !unrated) unrated = name;
    }
    return { rated, unrated };
  });

  async function open(name) {
    await page.evaluate((n) => {
      const card = [...document.querySelectorAll("[data-slot='card']")].find(
        (c) => c.querySelector("h3")?.textContent?.trim() === n
      );
      card?.click();
    }, name);
    await page.waitForFunction(() => /#\/products\/[^?]+/.test(location.hash) && !!document.querySelector("[data-slot='expiry-badge'], h1"), { timeout: 25000 });
    await page.waitForTimeout(1500);
    return page.evaluate(() => {
      const rating = document.querySelector("[data-slot='rating-badge']");
      const expiry = document.querySelector("[data-slot='expiry-badge']");
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) };
      };
      const host = rating?.parentElement || expiry?.parentElement;
      const hostRect = host?.getBoundingClientRect();
      const overlap = (() => {
        const a = rating?.getBoundingClientRect();
        const b = expiry?.getBoundingClientRect();
        if (!a || !b) return false;
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      })();
      return {
        hash: location.hash,
        title: document.querySelector("h1")?.textContent?.trim(),
        rating: rect(rating),
        ratingText: rating?.textContent?.trim(),
        expiry: rect(expiry),
        expiryText: expiry?.textContent?.trim(),
        host: hostRect
          ? { x: +hostRect.x.toFixed(1), y: +hostRect.y.toFixed(1), w: +hostRect.width.toFixed(1), h: +hostRect.height.toFixed(1), right: +hostRect.right.toFixed(1), bottom: +hostRect.bottom.toFixed(1) }
          : null,
        overlap,
        ratingInsideHost:
          !!hostRect && !!rating && rating.getBoundingClientRect().left >= hostRect.left && rating.getBoundingClientRect().right <= hostRect.right && rating.getBoundingClientRect().top >= hostRect.top && rating.getBoundingClientRect().bottom <= hostRect.bottom,
        expiryInsideHost: (() => {
          if (!hostRect || !expiry) return null;
          const r = expiry.getBoundingClientRect();
          return r.left >= hostRect.left && r.right <= hostRect.right && r.top >= hostRect.top && r.bottom <= hostRect.bottom;
        })(),
      };
    });
  }

  let ratedDetail = null;
  let unratedDetail = null;
  if (picks.rated) ratedDetail = await open(picks.rated);
  if (picks.unrated) {
    await page.goto(`${BASE}/#/products`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    unratedDetail = await open(picks.unrated);
  }
  await context.close();
  return { picks, ratedDetail, unratedDetail };
}

out["detail-390"] = await detailProbe(390);
out["detail-1440"] = await detailProbe(1440);

await browser.close();
console.log(JSON.stringify(out, null, 2));
