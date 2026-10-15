// Measure the rendered product card in each section, whether it is the inline
// Hot Sellers card or the shared ProductCard, so the reference and every other
// section can be compared directly.
//
//   node qa/measure-card-sections.mjs
//   W=1366 node qa/measure-card-sections.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "https://sunny-baths-help.freebuff.dev";
const W = Number(process.env.W || 1440);
const H = Number(process.env.H || 900);

const ROUTES = [
  ["home", "#/"],
  ["hot-sellers", "#/hot-sellers"],
  ["value-deals", "#/value-deals"],
  ["products", "#/products"],
];

const PROBE = () => {
  const px = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p) : null);
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.top), x: Math.round(b.left) };
  };
  // A "card" is either the shared ProductCard or the inline Hot Sellers card.
  const candidates = [
    ...document.querySelectorAll('[data-slot="card"]'),
    ...document.querySelectorAll('div[class*="rounded-2xl border border-border/70 bg-card"]'),
  ];
  const seen = new Set();
  const out = [];
  for (const card of candidates) {
    if (seen.has(card)) continue;
    seen.add(card);
    const t = card.textContent || "";
    if (!/add to cart|buy now|out of stock/i.test(t)) continue;
    const section = card.closest("section") || card.closest("main") || document.body;
    const head = section.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 22) || "?";
    const band = card.querySelector('div[class*="aspect-square"]');
    const img = card.querySelector("img");
    const h3 = card.querySelector("h3");
    const manu = h3?.nextElementSibling?.tagName === "P" ? h3.nextElementSibling : null;
    const price = [...card.querySelectorAll("span")].find((s) => /₹/.test(s.textContent || ""));
    const mrp = [...card.querySelectorAll("span")].find((s) => /line-through/.test(s.className));
    const buttons = [...card.querySelectorAll("button")];
    const cs = getComputedStyle(card);
    const cb = box(card);
    let drawn = null;
    if (img) {
      const b = img.getBoundingClientRect();
      const nW = img.naturalWidth || 0, nH = img.naturalHeight || 0;
      const s = nW && nH ? Math.min(b.width / nW, b.height / nH) : 0;
      drawn = { w: Math.round(nW * s), h: Math.round(nH * s), natAspect: nH ? +(nW / nH).toFixed(3) : null, fit: px(img, "object-fit") };
    }
    out.push({
      head,
      name: (h3?.textContent || "").trim().slice(0, 22),
      card: cb,
      depth: Math.round(card.getBoundingClientRect().bottom - card.getBoundingClientRect().top),
      cardPad: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      cardGap: cs.rowGap,
      cardRadius: cs.borderRadius,
      band: box(band),
      imgBox: img ? box(img) : null,
      drawn,
      title: h3 ? { box: box(h3), font: px(h3, "font-size"), lh: px(h3, "line-height"), clamp: px(h3, "-webkit-line-clamp"), lines: Math.round(h3.getBoundingClientRect().height / parseFloat(px(h3, "line-height"))) } : null,
      manu: manu ? { font: px(manu, "font-size"), h: box(manu)?.h } : null,
      price: price ? { font: px(price, "font-size"), h: box(price)?.h } : null,
      mrpFont: mrp ? px(mrp, "font-size") : null,
      buttons: buttons.map((b) => ({ label: (b.textContent || "").trim().slice(0, 14), ...box(b), font: px(b, "font-size"), radius: px(b, "borderRadius") })),
      offsets: {
        bandTop: band ? Math.round(band.getBoundingClientRect().top - cb.y) : null,
        bandBottom: band ? Math.round(cb.y + cb.h - band.getBoundingClientRect().bottom) : null,
        firstBtnTop: buttons[0] ? Math.round(buttons[0].getBoundingClientRect().top - cb.y) : null,
        lastBtnBottom: buttons.length ? Math.round(cb.y + cb.h - buttons[buttons.length - 1].getBoundingClientRect().bottom) : null,
      },
      overflowY: card.scrollHeight - card.clientHeight,
    });
  }
  return out;
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [label, route] of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("c:" + m.text().slice(0, 100)); });
  await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6500);
  await page.evaluate(async () => {
    const s = Math.round(innerHeight * 0.9);
    for (let y = 0; y < document.body.scrollHeight; y += s) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  const cards = await page.evaluate(PROBE);
  console.log(`\n########## ${label} (${route}) @ ${W}x${H} — ${cards.length} cards`);
  const bySection = cards.reduce((a, c) => ((a[c.head] ||= []).push(c), a), {});
  for (const [head, list] of Object.entries(bySection)) {
    const u = (fn) => [...new Set(list.map(fn))];
    const c0 = list[0];
    console.log(`  ${head} (n=${list.length})`);
    console.log(`    card      : ${u((c) => `${c.card.w}x${c.card.h}`).join(" || ")}   pad=${u((c) => c.cardPad).join("|")} gap=${u((c) => c.cardGap).join("|")} r=${u((c) => c.cardRadius).join("|")}`);
    console.log(`    band      : ${u((c) => (c.band ? `${c.band.w}x${c.band.h}` : "none")).join(" || ")}   img=${u((c) => (c.imgBox ? `${c.imgBox.w}x${c.imgBox.h}` : "none")).join(" || ")}  ${u((c) => c.drawn?.fit).join("|")}`);
    console.log(`    title     : font=${u((c) => c.title?.font).join("|")} lh=${u((c) => c.title?.lh).join("|")} clamp=${u((c) => c.title?.clamp).join("|")} lines=${u((c) => c.title?.lines).join("|")} h=${u((c) => c.title?.box?.h).join("|")}`);
    console.log(`    manu/price: manu=${u((c) => c.manu?.font).join("|")} (${u((c) => c.manu?.h).join("|")}px)  price=${u((c) => c.price?.font).join("|")} (${u((c) => c.price?.h).join("|")}px)  mrp=${u((c) => c.mrpFont).join("|")}`);
    console.log(`    buttons   : ${u((c) => c.buttons.map((b) => `${b.label}:${b.w}x${b.h}@${b.font}`).join(" + ")).join(" || ")}`);
    console.log(`    offsets   : bandTop=${u((c) => c.offsets.bandTop).join("|")} bandBottom=${u((c) => c.offsets.bandBottom).join("|")} firstBtnTop=${u((c) => c.offsets.firstBtnTop).join("|")} lastBtnBottom=${u((c) => c.offsets.lastBtnBottom).join("|")}`);
    console.log(`    overflow  : ${u((c) => c.overflowY).join("|")}`);
  }
  if (errs.length) console.log("  ERRORS", JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
}
await browser.close();
