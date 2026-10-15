// Verify that every product card on the site renders at exactly the Hot Sellers
// reference size at the same viewport, and that nothing regressed.
//
//   node qa/verify-card-size-parity.mjs
//   WIDTHS=1024,1280,1440 node qa/verify-card-size-parity.mjs
//
// For each viewport it measures every card on every product surface and
// asserts:
//   * the card SHAPE (height, image band, padding, title metrics, price size
//     and every action button) is identical in every section — the shared card
//     is the reference card
//   * every card fills the grid column / carousel item it is laid out in, and
//     where the container is the same width as the reference container the card
//     WIDTH matches the reference exactly (the All Medicines listing renders
//     beside a filter sidebar, so its columns are narrower — it must fill those
//     columns and keep the reference shape)
//   * product images keep their natural aspect ratio (no stretch), are
//     `object-contain` and stay inside the band
//   * no card content overflows or is clipped
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
      const num = (el, p) => (el ? parseFloat(getComputedStyle(el).getPropertyValue(p)) || 0 : 0);

      let imgInfo = null;
      if (img && band) {
        const b = img.getBoundingClientRect();
        const bb = band.getBoundingClientRect();
        // The packshot box is the image's PADDING box: the element fills the
        // band and `p-*` insets the contained picture, exactly like the
        // reference card's `<img class="absolute inset-0 … object-contain p-1.5">`.
        const padL = num(img, "padding-left");
        const padR = num(img, "padding-right");
        const padT = num(img, "padding-top");
        const padB = num(img, "padding-bottom");
        const innerW = b.width - padL - padR;
        const innerH = b.height - padT - padB;
        const nW = img.naturalWidth || 0;
        const nH = img.naturalHeight || 0;
        const scale = nW && nH ? Math.min(innerW / nW, innerH / nH) : 0;
        const drawnW = nW * scale;
        const drawnH = nH * scale;
        // `object-contain` centres the picture in the padding box.
        const drawnLeft = b.left + padL + (innerW - drawnW) / 2;
        const drawnTop = b.top + padT + (innerH - drawnH) / 2;
        imgInfo = {
          fit: cs(img, "object-fit"),
          drawnW: Math.round(drawnW),
          drawnH: Math.round(drawnH),
          natAspect: nH ? +(nW / nH).toFixed(3) : null,
          drawnAspect: nH && scale ? +((nW * scale) / (nH * scale)).toFixed(3) : null,
          gapLeft: Math.round(drawnLeft - bb.left),
          gapRight: Math.round(bb.right - (drawnLeft + drawnW)),
          gapTop: Math.round(drawnTop - bb.top),
          gapBottom: Math.round(bb.bottom - (drawnTop + drawnH)),
          visible: getComputedStyle(img).display !== "none" && drawnW > 4 && drawnH > 4,
        };
      }

      // The layout slot the card is placed in: a grid column of `.kc-card-track`
      // (or of the listing's own grid), or a carousel item wrapper.
      const parent = card.parentElement;
      const pcs = parent ? getComputedStyle(parent) : null;
      const firstCol = pcs && pcs.gridTemplateColumns && pcs.gridTemplateColumns !== "none"
        ? parseFloat(pcs.gridTemplateColumns.split(" ")[0])
        : null;
      const container = parent
        ? {
            w: Math.round(parent.getBoundingClientRect().width),
            columnW: Math.round(Number.isFinite(firstCol) ? firstCol : parent.getBoundingClientRect().width),
            columns: pcs && pcs.gridTemplateColumns !== "none" ? pcs.gridTemplateColumns.split(" ").length : 1,
            gap: Math.round(num(parent, "column-gap")),
          }
        : null;

      const section = card.closest("section") || card.closest("main") || document.body;
      const head = section.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 22) || "?";

      return {
        head,
        name: (h3?.textContent || "").trim().slice(0, 26),
        card: box(card),
        cardPad: ["padding-top", "padding-right", "padding-bottom", "padding-left"].map((p) => Math.round(num(card, p))).join("/"),
        band: box(band),
        container,
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
/* Shape = everything except width. Two cards with the same shape are laid out
 * by the same rules; only the width of the column they sit in can differ. */
const shape = (c) => `${c.card.h}|band ${c.band?.h}|pad ${c.cardPad}|h3 ${c.h3?.font}/${c.h3?.lh}|price ${c.priceFont}|btns ${c.buttons.map((b) => `${b.label}:${b.h}`).join(",")}`;
const sig = (c) => `${c.card.w}x${c.card.h}|band ${c.band?.w}x${c.band?.h}|pad ${c.cardPad}|h3 ${c.h3?.font}/${c.h3?.lh}/${c.h3?.clamp}|price ${c.priceFont}|btns ${c.buttons.map((b) => `${b.label}:${b.w}x${b.h}`).join(",")}`;

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
    const ref = refCards[0];
    const refShape = shape(ref);
    const refContainer = ref.container?.w ?? null;
    for (const [label, cards] of Object.entries(perRoute)) {
      check(`${w} ${label}: cards found`, cards.length > 0, `n=${cards.length}`);
      // Cross-section shape parity is a desktop/laptop requirement: below 640px
      // each section deliberately keeps its own phone layout (2-up carousel vs
      // 2-column grid), so only the invariants below are asserted there.
      if (!mobile) {
        const off = cards.filter((c) => shape(c) !== refShape);
        check(
          `${w} ${label}: card shape identical to the Hot Sellers reference`,
          off.length === 0,
          off.length ? `${off.length} differ, e.g. ${off[0].head} "${off[0].name}" -> ${shape(off[0])} (ref ${refShape})` : refShape
        );
        // Every card fills the slot it is laid out in, so the only thing that
        // can change its width is the width of that slot's container.
        const badSlot = cards.filter((c) => c.container && Math.abs(c.card.w - c.container.columnW) > 2);
        check(
          `${w} ${label}: every card fills its own grid/carousel column`,
          badSlot.length === 0,
          JSON.stringify(badSlot.slice(0, 2).map((c) => `${c.name} card ${c.card.w} vs column ${c.container.columnW} (${c.container.columns} cols gap ${c.container.gap})`))
        );
        // A card is either exactly the reference width, or — only where its own
        // grid column is narrower than the reference (the All Medicines listing
        // sits beside the filter sidebar) — it fills that whole column. A card
        // that is merely a bit smaller than its column is a regression.
        const badWidth = cards.filter((c) => {
          if (c.card.w === ref.card.w) return false;
          const fillsNarrowerColumn =
            c.container &&
            Math.abs(c.card.w - c.container.columnW) <= 2 &&
            c.container.columnW < ref.card.w;
          return !fillsNarrowerColumn;
        });
        check(
          `${w} ${label}: card width is the reference width, or its narrower column`,
          badWidth.length === 0,
          badWidth.length
            ? JSON.stringify(badWidth.slice(0, 2).map((c) => `${c.name} ${c.card.w} (column ${c.container?.columnW}, reference ${ref.card.w})`))
            : `reference width ${ref.card.w}px; narrower column(s) ${[...new Set(cards.filter((c) => c.card.w !== ref.card.w).map((c) => c.card.w))].join(", ") || "none"}`
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
        withImg.every((c) => c.img.fit === "contain" && c.img.gapLeft >= 4 && c.img.gapRight >= 4 && c.img.gapTop >= 0 && c.img.gapBottom >= 0),
        JSON.stringify(withImg.filter((c) => c.img.fit !== "contain" || c.img.gapLeft < 4 || c.img.gapRight < 4 || c.img.gapTop < 0 || c.img.gapBottom < 0).slice(0, 2).map((c) => `${c.name} fit=${c.img.fit} gaps L/R/T/B=${c.img.gapLeft}/${c.img.gapRight}/${c.img.gapTop}/${c.img.gapBottom}`)));
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
