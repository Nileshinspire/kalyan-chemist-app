// Verify the product-card `Add` control sits on the price row at the card's
// bottom-right (Blinkit placement) on desktop, and that phones keep their
// unchanged Buy Now / Cart row with no horizontal overflow.
// Usage: node qa/verify-add-button-row.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { assertPreview, launch, go, report, interesting } from "./harness.mjs";

const SHOTS = "qa/shots";
mkdirSync(SHOTS, { recursive: true });

const PROBE = () => {
  const B = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const cards = [...document.querySelectorAll('[data-slot="card"]')].filter((c) =>
    /buy now|cart|out of stock|sold out/i.test(c.textContent || "")
  );
  const rows = cards.map((card) => {
    const add = [...card.querySelectorAll("button")].find((b) => /^(add|sold out)$/i.test((b.textContent || "").trim()));
    const price = card.querySelector("div.font-extrabold");
    const name = card.querySelector("h3");
    const phoneRow = [...card.querySelectorAll("button")].find((b) => /^(buy now|out of stock)$/i.test((b.textContent || "").trim()));
    const cb = B(card);
    const ab = add ? B(add) : null;
    const pb = price ? B(price) : null;
    const overlap = (a, b) =>
      a && b && a.y < b.y + b.h && b.y < a.y + a.h && a.x < b.x + b.w && b.x < a.x + a.w;
    return {
      name: (name?.textContent || "").trim().slice(0, 24),
      card: cb,
      price: pb,
      add: ab,
      addVisible: !!add && add.getBoundingClientRect().width > 0,
      phoneRowVisible: !!phoneRow && phoneRow.getBoundingClientRect().width > 0,
      // same row: vertical centers within one price line height
      sameRowAsPrice: ab && pb ? Math.abs(ab.y + ab.h / 2 - (pb.y + pb.h / 2)) <= 14 : null,
      // right-aligned: button right edge within 20px of card right edge
      rightEdgeGap: ab ? cb.x + cb.w - (ab.x + ab.w) : null,
      // below the product name (no overlap with name / price text)
      overlapsName: overlap(ab, name ? B(name) : null),
      overlapsPrice: overlap(ab, pb),
    };
  });
  return {
    cards: rows.length,
    docScrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    rows,
  };
};

async function run(mobile) {
  const { browser, page, consoleErrors, pageErrors } = await launch({ mobile });
  await go(page, "#/products");
  await page.waitForTimeout(2500);
  const data = await page.evaluate(PROBE);
  const tag = mobile ? "mobile-390" : "desktop-1440";
  await page.screenshot({ path: `${SHOTS}/add-button-${tag}.png`, fullPage: false });
  await browser.close();
  return { tag, data, consoleErrors: interesting(consoleErrors), pageErrors };
}

await assertPreview();
const desktop = await run(false);
const mobile = await run(true);

const d = desktop.data;
const fails = [];
for (const r of d.rows) {
  if (!r.addVisible) fails.push(`${r.name}: Add button not visible on desktop`);
  if (r.addVisible && r.sameRowAsPrice === false) fails.push(`${r.name}: Add not on price row (Δ=${Math.abs(0)})`);
  if (r.addVisible && (r.rightEdgeGap === null || r.rightEdgeGap > 24)) fails.push(`${r.name}: Add not near right edge (gap=${r.rightEdgeGap})`);
  if (r.overlapsName) fails.push(`${r.name}: Add overlaps product name`);
  if (r.overlapsPrice) fails.push(`${r.name}: Add overlaps price`);
}
if (d.docScrollW > d.innerW + 1) fails.push(`desktop horizontal overflow: ${d.docScrollW} > ${d.innerW}`);
for (const r of mobile.data.rows) {
  if (r.addVisible) fails.push(`${r.name}: desktop Add button leaked onto mobile`);
  if (!r.phoneRowVisible) fails.push(`${r.name}: phone Buy Now / Cart row missing`);
}
if (mobile.data.docScrollW > mobile.data.innerW + 1)
  fails.push(`mobile horizontal overflow: ${mobile.data.docScrollW} > ${mobile.data.innerW}`);

report("desktop", { tag: desktop.tag, cards: d.cards, rows: d.rows, consoleErrors: desktop.consoleErrors, pageErrors: desktop.pageErrors });
report("mobile", { tag: mobile.tag, cards: mobile.data.cards, scrollW: mobile.data.docScrollW, innerW: mobile.data.innerW, consoleErrors: mobile.consoleErrors, pageErrors: mobile.pageErrors });
report("result", { pass: fails.length === 0, fails });

if (fails.length) process.exit(1);
process.exit(0);
