// Audit rendered desktop product-card geometry, section by section.
//
//   node qa/card-size-audit.mjs            # default 1440x900
//   W=1366 node qa/card-size-audit.mjs
//   W=1536 H=960 node qa/card-size-audit.mjs
//
// Reports, for every product card on the page: outer card box, image band,
// rendered image, content padding, title/manufacturer/price metrics and the
// action-button boxes — so any section that deviates from the Hot Sellers
// reference is visible as numbers rather than "looks about right".
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE || "https://sunny-baths-help.freebuff.dev";
const W = Number(process.env.W || 1440);
const H = Number(process.env.H || 900);
const SHOTS = join(process.cwd(), "qa/shots");
mkdirSync(SHOTS, { recursive: true });

const ROUTES = [
  ["landing", "#/"],
  ["hot-sellers", "#/hot-sellers"],
  ["value-deals", "#/value-deals"],
  ["products", "#/products"],
];

const PROBE = () => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.left), y: Math.round(b.top) };
  };
  const cs = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
  return [...document.querySelectorAll('[data-slot="card"]')]
    .filter((c) => /buy now|cart|out of stock/i.test(c.textContent || ""))
    .map((card) => {
      const wrap = card.parentElement;
      const band =
        card.querySelector('div[class*="aspect-square"]') ||
        card.querySelector('div[class*="h-24"], div[class*="h-30"], div[class*="h-44"]');
      const img = card.querySelector("img");
      const h3 = card.querySelector("h3");
      const manu = h3?.nextElementSibling || null;
      const price = [...card.querySelectorAll("span")].find((s) => /₹/.test(s.textContent || ""));
      const mrp = [...card.querySelectorAll("span")].find((s) => /line-through/.test(s.className));
      const buttons = [...card.querySelectorAll("button")];
      const actionRow = buttons[buttons.length - 1]?.parentElement || null;
      const content = h3?.closest('[data-slot="card-content"]') || null;
      const section = card.closest("section") || card.closest("main") || document.body;
      const head = section.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 26) || "?";
      const cc = content ? getComputedStyle(content) : null;

      let drawn = null;
      if (img) {
        const b = img.getBoundingClientRect();
        const nW = img.naturalWidth || 0;
        const nH = img.naturalHeight || 0;
        const scale = nW && nH ? Math.min(b.width / nW, b.height / nH) : 0;
        drawn = {
          w: Math.round(nW * scale),
          h: Math.round(nH * scale),
          natAspect: nH ? +(nW / nH).toFixed(3) : null,
          drawnAspect: nW * scale ? +((nW * scale) / (nH * scale)).toFixed(3) : null,
        };
      }

      return {
        head,
        name: (h3?.textContent || "").trim().slice(0, 22),
        wrap: r(wrap),
        card: r(card),
        band: r(band),
        img: img ? { ...r(img), fit: cs(img, "object-fit") } : null,
        drawn,
        contentPad: cc ? `${cc.paddingTop} ${cc.paddingRight} ${cc.paddingBottom} ${cc.paddingLeft}` : null,
        contentGap: cc ? cc.rowGap : null,
        h3: h3
          ? {
              ...r(h3),
              font: cs(h3, "font-size"),
              lh: cs(h3, "line-height"),
              clamp: cs(h3, "-webkit-line-clamp"),
              lines: Math.round(h3.getBoundingClientRect().height / parseFloat(cs(h3, "line-height"))),
            }
          : null,
        manu: manu && manu.tagName === "P" ? { w: r(manu)?.w, font: cs(manu, "font-size"), h: r(manu)?.h } : null,
        price: price ? { ...r(price), font: cs(price, "font-size") } : null,
        mrp: mrp ? { font: cs(mrp, "font-size") } : null,
        actionRow: r(actionRow),
        buttons: buttons.map((b) => ({ ...r(b), label: (b.textContent || "").trim().slice(0, 12) })),
        offsets: {
          bandTop: r(band) && r(card) ? r(band).y - r(card).y : null,
          contentTop: r(content) && r(card) ? r(content).y - r(card).y : null,
          actionBottom: r(actionRow) && r(card) ? r(card).y + r(card).h - (r(actionRow).y + r(actionRow).h) : null,
          actionLeft: r(actionRow) && r(card) ? r(actionRow).x - r(card).x : null,
        },
        cardClasses: String(card.className).slice(0, 160),
        wrapClasses: String(wrap?.className || "").slice(0, 160),
      };
    });
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const summary = {};
for (const [label, route] of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("c:" + m.text().slice(0, 120)); });
  await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6500);
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
  const bySection = {};
  for (const c of cards) {
    (bySection[c.head] ||= []).push(c);
  }
  summary[label] = bySection;
  console.log(`\n########## ${label} (${route}) @ ${W}x${H} — ${cards.length} cards — errors=${errs.length} ##########`);
  for (const [head, list] of Object.entries(bySection)) {
    const uniq = (fn) => [...new Set(list.map(fn))];
    console.log(
      `  ${head} (n=${list.length})  card=${JSON.stringify(uniq((c) => `${c.card.w}x${c.card.h}`))}` +
        ` band=${JSON.stringify(uniq((c) => (c.band ? `${c.band.w}x${c.band.h}` : null)))}` +
        ` pad=${JSON.stringify(uniq((c) => c.contentPad))}` +
        ` h3=${JSON.stringify(uniq((c) => `${c.h3?.font}/${c.h3?.lh}/${c.h3?.clamp}/${c.h3?.lines}L`))}` +
        ` price=${JSON.stringify(uniq((c) => c.price?.font))}` +
        ` btns=${JSON.stringify(uniq((c) => c.buttons.map((b) => `${b.label || "-"}:${b.w}x${b.h}`).join(",")))}`
    );
    console.log(`      wrapClasses: ${list[0].wrapClasses}`);
  }
  if (errs.length) console.log("  ERRORS", JSON.stringify(errs.slice(0, 4)));
  await page.screenshot({ path: join(SHOTS, `audit-${label}-${W}.png`), fullPage: false });
  await ctx.close();
}
await browser.close();
console.log("\nFULL JSON:\n" + JSON.stringify(summary, null, 1));
