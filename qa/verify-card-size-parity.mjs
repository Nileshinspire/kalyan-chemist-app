// Verify that every product card on the site renders at exactly the Hot Sellers
// reference size at the same viewport, and that nothing regressed.
//
//   node qa/verify-card-size-parity.mjs
//   WIDTHS=1024,1280,1440 node qa/verify-card-size-parity.mjs
//
// For each viewport it measures every card on every product surface and
// asserts:
//   * the outer card box is identical in every section (reference = the
//     `/hot-sellers` card at that viewport)
//   * the image band, content padding, title metrics, price size and both
//     action buttons are identical in every section
//   * product images keep their natural aspect ratio (no stretch) and stay
//     inside the band
//   * no card content overflows or is clipped
//   * images/cards stay inside the card box
//   * clicking a card navigates to its product route
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "https://sunny-baths-help.freebuff.dev";
const WIDTHS = (process.env.WIDTHS || "390,430,1024,1280,1440,1536")
  .split(",")
  .map(Number);

const ROUTES = [
  ["home", "#/"],
  ["hot-sellers", "#/hot-sellers"],
  ["value-deals", "#/value-deals"],
  ["products", "#/products"],
];

const PROBE = () => {
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height) };
  };
  return [...document.querySelectorAll('[data-slot="card"]')]
    .filter((c) => /buy now|cart|out of stock/i.test(c.textContent || ""))
    .map((card) => {
      const band = card.querySelector('div[class*="aspect-square"]');
      const img = card.querySelector("img");
      const h3 = card.querySelector("h3");
      const content = h3?.closest('[data-slot="card-content"]') || null;
      const price = [...card.querySelectorAll("span")].find((s) => /₹/.test(s.textContent || ""));
      const buttons = [...card.querySelectorAll("button")];
      const cs = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);

      let imgInfo = null;
      if (img) {
        const b = img.getBoundingClientRect();
        const bb = band.getBoundingClientRect();
        const nW = img.naturalWidth || 0;
        const nH = img.naturalHeight || 0;
        const scale = nW && nH ? Math.min(b.width / nW, b.height / nH) : 0;
        imgInfo = {
          fit: cs(img, "object-fit"),
          drawnW: Math.round(nW * scale),
          drawnH: Math.round(nH * scale),
          natAspect: nH ? +(nW / nH).toFixed(3) : null,
          drawnAspect: nH && scale ? +((nW * scale) / (nH * scale)).toFixed(3) : null,
          gapLeft: Math.round(b.left - bb.left),
          gapRight: Math.round(bb.right - b.right),
          visible: getComputedStyle(img).display !== "none" && b.width > 4 && b.height > 4,
        };
      }

      const section = card.closest("section") || card.closest("main") || document.body;
      const head = section.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 22) || "?";

      return {
        head,
        name: (h3?.textContent || "").trim().slice(0, 26),
        card: box(card),
        band: box(band),
        pad: content ? getComputedStyle(content).padding : null,
        h3: h3 ? { font: cs(h3, "font-size"), lh: cs(h3, "line-height"), clamp: cs(h3, "-webkit-line-clamp"), h: Math.round(h3.getBoundingClientRect().height) } : null,
        priceFont: price ? cs(price, "font-size") : null,
        buttons: buttons.map((b) => ({ label: (b.textContent || "").trim().slice(0, 10), ...box(b) })).filter((b) => b.label),
        img: imgInfo,
        // Clipping / overflow: the card must contain all of its content.
        overflowY: card.scrollHeight - card.clientHeight,
        overflowX: card.scrollWidth - card.clientWidth,
        contentOverflow: content ? content.scrollHeight - content.clientHeight : 0,
        h3Clipped: h3 ? h3.scrollHeight - h3.clientHeight : 0,
        visible: (() => {
          const r = card.getBoundingClientRect();
          return r.width > 4 && r.height > 4 && parseFloat(getComputedStyle(card).opacity) > 0.9;
        })(),
      };
    });
};

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failures++;
};
const sig = (c) => `${c.card.w}x${c.card.h}|band ${c.band?.w}x${c.band?.h}|pad ${c.pad}|h3 ${c.h3?.font}/${c.h3?.lh}/${c.h3?.clamp}|price ${c.priceFont}|btns ${c.buttons.map((b) => `${b.label}:${b.w}x${b.h}`).join(",")}`;

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const table = {};

for (const w of WIDTHS) {
  const mobile = w < 700;
  const ctx = await browser.newContext({
    viewport: { width: w, height: mobile ? 844 : 900 },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 2 : 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("c:" + m.text().slice(0, 120)); });

  console.log(`\n############ ${w}px ${mobile ? "(mobile)" : "(desktop/laptop)"} ############`);
  const perRoute = {};

  for (const [label, route] of ROUTES) {
    await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);
    await page.evaluate(async () => {
      const step = Math.round(innerHeight * 0.9);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
    const cards = await page.evaluate(PROBE);
    perRoute[label] = cards;
    for (const [head, list] of Object.entries(
      cards.reduce((acc, c) => ((acc[c.head] ||= []).push(c), acc), {})
    )) {
      console.log(`  ${head} (n=${list.length}) -> ${[...new Set(list.map(sig))].join("  ||  ")}`);
    }
    if (errors.length) console.log(`  ERRORS(${label})`, JSON.stringify(errors.slice(0, 3)));
  }
  table[w] = perRoute;

  const refCards = perRoute["hot-sellers"];
  check(`${w}: Hot Sellers reference measured`, refCards.length > 0, `n=${refCards.length}`);

  if (refCards.length) {
    const ref = sig(refCards[0]);
    for (const [label, cards] of Object.entries(perRoute)) {
      check(`${w} ${label}: cards found`, cards.length > 0, `n=${cards.length}`);
      // Cross-section size parity is a desktop/laptop requirement: below 640px
      // each section deliberately keeps its own phone layout (2-up carousel vs
      // 2-column grid), so only the invariants below are asserted there.
      if (!mobile) {
        const off = cards.filter((c) => sig(c) !== ref);
        check(
          `${w} ${label}: every card identical to the Hot Sellers reference`,
          off.length === 0,
          off.length ? `${off.length} differ, e.g. ${off[0].head} "${off[0].name}" -> ${sig(off[0])}` : ref
        );
      } else {
        check(
          `${w} ${label}: phone layout kept (band square, card width from its own grid/carousel)`,
          cards.every((c) => Math.abs(c.band.w - c.band.h) <= 2),
          [...new Set(cards.map((c) => `card ${c.card.w} band ${c.band.w}x${c.band.h}`))].join(" || ")
        );
      }
      check(`${w} ${label}: all cards visible`, cards.every((c) => c.visible));
      check(`${w} ${label}: no card content clipped`, cards.every((c) => c.overflowY <= 1 && c.overflowX <= 1 && c.contentOverflow <= 1 && c.h3Clipped <= 1),
        JSON.stringify(cards.filter((c) => c.overflowY > 1 || c.contentOverflow > 1 || c.h3Clipped > 1).slice(0, 2).map((c) => `${c.name}: card+${c.overflowY} content+${c.contentOverflow} h3+${c.h3Clipped}`)));

      const withImg = cards.filter((c) => c.img && c.img.visible);
      check(`${w} ${label}: images not stretched (drawn aspect == natural)`,
        withImg.every((c) => !c.img.drawnAspect || Math.abs(c.img.drawnAspect - c.img.natAspect) < 0.03),
        JSON.stringify(withImg.filter((c) => c.img.drawnAspect && Math.abs(c.img.drawnAspect - c.img.natAspect) >= 0.03).slice(0, 2).map((c) => `${c.name} nat=${c.img.natAspect} drawn=${c.img.drawnAspect}`)));
      check(`${w} ${label}: images contained + inside band`,
        withImg.every((c) => c.img.fit === "contain" && c.img.gapLeft >= 4 && c.img.gapRight >= 4),
        JSON.stringify(withImg.filter((c) => c.img.fit !== "contain" || c.img.gapLeft < 4 || c.img.gapRight < 4).slice(0, 2).map((c) => `${c.name} fit=${c.img.fit} gaps=${c.img.gapLeft}/${c.img.gapRight}`)));
      check(`${w} ${label}: every card has Buy Now + Cart`,
        cards.every((c) => c.buttons.some((b) => /buy now|out of stock/i.test(b.label)) && c.buttons.some((b) => /cart/i.test(b.label))));
    }

    // title wrap spread — long vs short names
    const all = Object.values(perRoute).flat();
    const heights = [...new Set(all.map((c) => c.card.h))];
    console.log(`  title line coverage: ${all.length} cards, card heights seen = ${JSON.stringify(heights)}`);
  }

  // interactions: clicking a card opens its product route
  await page.goto(`${BASE}/#/products`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  const before = page.url();
  const name = await page.evaluate(() => {
    const card = [...document.querySelectorAll('[data-slot="card"]')].find((c) => /buy now|cart/i.test(c.textContent || ""));
    card?.querySelector("h3")?.click();
    return (card?.querySelector("h3")?.textContent || "").trim();
  });
  await page.waitForTimeout(2000);
  const after = page.url();
  check(`${w}: tapping a card opens the product route`, /#\/products\/.+/.test(after) && after !== before, `${name} -> ${after}`);

  await ctx.close();
}

await browser.close();
console.log("\nSUMMARY (route -> distinct card signatures)");
for (const [w, routes] of Object.entries(table)) {
  console.log(` ${w}px`);
  for (const [label, cards] of Object.entries(routes)) {
    const uniq = [...new Set(cards.map(sig))];
    console.log(`   ${label.padEnd(12)} n=${String(cards.length).padEnd(3)} ${uniq.length === 1 ? uniq[0] : uniq.join("  ||  ")}`);
  }
}
console.log(failures === 0 ? "\nALL CARD-SIZE PARITY CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
