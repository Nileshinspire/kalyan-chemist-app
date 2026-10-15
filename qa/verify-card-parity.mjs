// Card parity: the Hot Sellers card is the reference, and every other product
// section must render that exact box at the same desktop viewport.
//
//   node qa/verify-card-parity.mjs                 # 1366 + 1440 + mobile
//   W=1440 node qa/verify-card-parity.mjs
//
// For each surface it measures the first card of the section (and checks every
// card in the section agrees), then compares the numbers against the homepage
// Hot Sellers reference card. Desktop also checks that a card exposes exactly
// ONE visible action button (the reference's full-width Add to Cart), and the
// phone pass checks the untouched two-button mobile card plus page overflow.
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "https://sunny-baths-help.freebuff.dev";
const WIDTHS = (process.env.WIDTHS || "1366,1440").split(",").map(Number);

const ROUTES = [
  ["home", "#/"],
  ["hot-sellers", "#/hot-sellers"],
  ["value-deals", "#/value-deals"],
  ["products", "#/products"],
];

/* Cards expose themselves either through `data-slot="card"` (the shared
 * ProductCard) or, for the inline Hot Sellers reference, through the reference
 * class list itself. */
const PROBE = () => {
  const css = (el, p) => getComputedStyle(el).getPropertyValue(p);
  const px = (el, p) => parseFloat(css(el, p)) || 0;
  const box = (el) => {
    const b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), top: b.top, bottom: b.bottom, left: b.left };
  };
  const visible = (el) => {
    const b = el.getBoundingClientRect();
    return b.width > 1 && b.height > 1;
  };
  const all = [
    ...document.querySelectorAll('[data-slot="card"]'),
    ...document.querySelectorAll('div[class*="rounded-2xl border border-border/70 bg-card"]'),
  ];
  const seen = new Set();
  const cards = [];
  for (const card of all) {
    if (seen.has(card)) continue;
    seen.add(card);
    if (!/add to cart|buy now|out of stock/i.test(card.textContent || "")) continue;
    const section = card.closest("section") || card.closest("main") || document.body;
    const head = (section.querySelector("h1,h2")?.textContent || "?").replace(/\s+/g, " ").trim();
    const r = card.getBoundingClientRect();
    const band = card.querySelector('div[class*="aspect-square"]');
    const img = card.querySelector("img");
    const h3 = card.querySelector("h3");
    const manu = h3?.nextElementSibling?.tagName === "P" ? h3.nextElementSibling : null;
    const price = [...card.querySelectorAll("span")].find((s) => /₹/.test(s.textContent || ""));
    const actionButtons = [...card.querySelectorAll("button")].filter((b) =>
      /buy now|cart|out of stock|add to cart/i.test(b.textContent || "")
    );
    const shown = actionButtons.filter(visible);
    const labels = [...card.querySelectorAll("p,span,div")].length;
    cards.push({
      head,
      name: (h3?.textContent || "").trim().slice(0, 24),
      w: Math.round(r.width),
      h: Math.round(r.height),
      pad: ["padding-top", "padding-right", "padding-bottom", "padding-left"].map((p) => Math.round(px(card, p))).join("/"),
      radius: css(card, "border-radius"),
      borderColor: css(card, "border-top-color"),
      band: band ? { w: Math.round(box(band).w), h: Math.round(box(band).h) } : null,
      imgFit: img ? css(img, "object-fit") : null,
      imgBox: img ? { w: Math.round(box(img).w), h: Math.round(box(img).h) } : null,
      title: h3 ? { font: css(h3, "font-size"), lh: css(h3, "line-height"), h: Math.round(box(h3).h) } : null,
      manu: manu ? { font: css(manu, "font-size"), h: Math.round(box(manu).h) } : null,
      price: price ? { font: css(price, "font-size"), h: Math.round(box(price).h) } : null,
      actions: shown.map((b) => ({ label: (b.textContent || "").trim(), w: Math.round(box(b).w), h: Math.round(box(b).h), font: css(b, "font-size") })),
      hiddenActions: actionButtons.length - shown.length,
      bandTopOffset: band ? Math.round(box(band).top - r.top) : null,
      lastActionBottomOffset: shown.length ? Math.round(r.bottom - box(shown[shown.length - 1]).bottom) : null,
      clipped: card.scrollHeight - card.clientHeight,
      // phone-only card furniture, used to prove mobile did not move
      chipRow: !!card.querySelector('[data-slot="card-content"] [class*="flex-wrap"][class*="sm:hidden"]'),
      dosageLine: !!card.querySelector('[data-slot="card-content"] p[class*="sm:hidden"]'),
      overflowCount: labels,
    });
  }
  return {
    cards,
    headings: [...document.querySelectorAll("h2")].map((h) => (h.textContent || "").trim()),
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
  };
};

async function load(page, route) {
  await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6500);
  await page.evaluate(async () => {
    const s = Math.round(innerHeight * 0.9);
    for (let y = 0; y < document.body.scrollHeight; y += s) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const ok = (msg) => console.log(`  ok    ${msg}`);

for (const W of WIDTHS) {
  console.log(`\n================ DESKTOP ${W}x900 ================`);
  const perRoute = {};
  for (const [label, route] of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
    const page = await ctx.newPage();
    await load(page, route);
    perRoute[label] = await page.evaluate(PROBE);
    await ctx.close();
  }

  const home = perRoute.home.cards;
  const ref = home.find((c) => c.head === "Hot Sellers");
  if (!ref) {
    fail("homepage Hot Sellers reference card not found");
  } else {
    console.log(`\nREFERENCE  home · Hot Sellers · "${ref.name}"  ${ref.w}x${ref.h}  pad=${ref.pad} r=${ref.radius}`);
    console.log(`           band ${ref.band.w}x${ref.band.h}  title ${ref.title.font}/${ref.title.lh}  manu ${ref.manu.font}  price ${ref.price.font}`);
    console.log(`           actions ${ref.actions.map((a) => `${a.label} ${a.w}x${a.h}@${a.font}`).join(" + ")}`);

    const sections = [
      ["home", "New Arrivals"],
      ["home", "Value Deals Under ₹100"],
      ["home", "Best Deals Right Now"],
      ["hot-sellers", "Hot Sellers"],
      ["value-deals", "Value Deals Under ₹100"],
      ["products", "All Medicines"],
    ];
    const headings = perRoute.home.headings;
    for (const [route, head] of sections) {
      const list = (perRoute[route]?.cards || []).filter((c) => c.head === head);
      if (!list.length) {
        // A section whose container query returns no rows is not rendered at
        // all (homepage Best Deals needs featured products), so there is no
        // card to compare — that is a data condition, not a card mismatch.
        if (route === "home" && !headings.includes(head)) {
          console.log(`\n${route} · ${head}: skipped — section not rendered (no rows in this data set)`);
          continue;
        }
        fail(`${route} · ${head}: no product cards found`);
        continue;
      }
      const c = list[0];
      const uniform = new Set(list.map((x) => `${x.w}x${x.h}`)).size === 1;
      const dW = c.w - ref.w;
      console.log(`\n${route} · ${head} (n=${list.length}) · "${c.name}"  ${c.w}x${c.h}  (Δw ${dW >= 0 ? "+" : ""}${dW})`);
      if (!uniform) fail(`${head}: cards differ inside the section — ${[...new Set(list.map((x) => `${x.w}x${x.h}`))].join(", ")}`);
      else ok(`every card in the section is ${c.w}x${c.h}`);
      if (c.h !== ref.h) fail(`${head}: height ${c.h} != reference ${ref.h}`);
      else ok(`height ${c.h} === reference`);
      if (c.pad !== ref.pad) fail(`${head}: padding ${c.pad} != reference ${ref.pad}`);
      else ok(`padding ${c.pad} === reference`);
      if (c.radius !== ref.radius) fail(`${head}: radius ${c.radius} != reference ${ref.radius}`);
      else ok(`radius ${c.radius} === reference`);
      if (c.band.h !== ref.band.h) fail(`${head}: image band ${c.band.w}x${c.band.h} != reference height ${ref.band.h}`);
      else ok(`image band height ${c.band.h} === reference (band width ${c.band.w} vs ${ref.band.w})`);
      if (c.imgFit !== null && c.imgFit !== "contain") fail(`${head}: image object-fit ${c.imgFit} (must be contain — never stretched)`);
      if (c.title.font !== ref.title.font || c.title.lh !== ref.title.lh || c.title.h !== ref.title.h)
        fail(`${head}: title ${c.title.font}/${c.title.lh} h=${c.title.h} != reference ${ref.title.font}/${ref.title.lh} h=${ref.title.h}`);
      else ok(`title ${c.title.font}/${ref.title.lh}, box ${c.title.h}px === reference`);
      if (c.manu.font !== ref.manu.font || c.manu.h !== ref.manu.h)
        fail(`${head}: manufacturer ${c.manu.font}/${c.manu.h} != reference ${ref.manu.font}/${ref.manu.h}`);
      else ok(`manufacturer ${c.manu.font} (${c.manu.h}px) === reference`);
      if (c.price.font !== ref.price.font) fail(`${head}: price font ${c.price.font} != reference ${ref.price.font}`);
      else ok(`price ${c.price.font} === reference`);
      if (c.actions.length !== 1) fail(`${head}: ${c.actions.length} visible action buttons (reference has exactly 1: ${ref.actions[0].label})`);
      else if (c.actions[0].h !== ref.actions[0].h) fail(`${head}: button height ${c.actions[0].h} != reference ${ref.actions[0].h}`);
      else ok(`one visible action "${c.actions[0].label}" ${c.actions[0].w}x${c.actions[0].h} === reference ${ref.actions[0].w}x${ref.actions[0].h}`);
      if (c.clipped !== 0) fail(`${head}: card clips its own content (overflow ${c.clipped}px)`);
      if (Math.abs(dW) > 12) fail(`${head}: width ${c.w} differs from the reference ${ref.w} by ${dW}px`);
      else if (dW !== 0) ok(`width ${c.w} is ${Math.abs(dW)}px off the reference (container is narrower beside the filter sidebar)`);
      if (c.lastActionBottomOffset !== ref.lastActionBottomOffset)
        fail(`${head}: button bottom inset ${c.lastActionBottomOffset} != reference ${ref.lastActionBottomOffset}`);
      else ok(`button bottom inset ${c.lastActionBottomOffset}px === reference`);
    }
  }

  // No horizontal page overflow anywhere.
  for (const [label, res] of Object.entries(perRoute)) {
    if (res.docScrollW > res.docClientW + 1) fail(`${label}: page overflows horizontally (${res.docScrollW} > ${res.docClientW})`);
  }
}

/* ── phones: the mobile card must be exactly what it was ── */
const MOBILE = 390;
console.log(`\n================ MOBILE ${MOBILE}x844 ================`);
for (const [label, route] of ROUTES) {
  const ctx = await browser.newContext({
    viewport: { width: MOBILE, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await load(page, route);
  const res = await page.evaluate(PROBE);
  const shared = res.cards.filter((c) => c.hiddenActions > 0 || c.actions.length > 0);
  const bySection = shared.reduce((a, c) => ((a[c.head] ||= []).push(c), a), {});
  console.log(`\n${label} · overflow ${res.docScrollW} vs ${res.docClientW}`);
  if (res.docScrollW > res.docClientW + 1) fail(`${label} (phone): horizontal overflow`);
  for (const [head, list] of Object.entries(bySection)) {
    const c = list[0];
    const widths = [...new Set(list.map((x) => x.w))].join("/");
    const heights = [...new Set(list.map((x) => x.h))].join("/");
    console.log(
      `  ${head} (n=${list.length})  card ${widths}x${heights}  band ${c.band.w}x${c.band.h}  actions ${c.actions.map((a) => `${a.label}:${a.w}x${a.h}`).join(" + ")}  chips=${c.chipRow} dosage=${c.dosageLine}`
    );
  }
  await ctx.close();
}

/* ── interactions ── */
console.log(`\n================ INTERACTIONS @ 1366 ================`);
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
  await load(page, "#/");

  // 1. the desktop Add to Cart on a New Arrivals card, signed out → auth wall
  const newArrivals = page.locator("section", { has: page.locator("h2", { hasText: "New Arrivals" }) }).first();
  const addBtn = newArrivals.getByRole("button", { name: /^Add to Cart$/ }).first();
  console.log(`  New Arrivals Add to Cart visible: ${await addBtn.isVisible()}`);
  await addBtn.click();
  await page.waitForTimeout(2500);
  const afterCart = page.url().split("#")[1] || "/";
  if (!/^\/auth/.test(afterCart)) fail(`Add to Cart while signed out did not reach the auth wall (hash: ${afterCart})`);
  else ok(`Add to Cart while signed out → ${afterCart}`);

  // 2. the card itself still opens Product Details
  await load(page, "#/");
  const firstCard = page.locator('[data-slot="card"]').first();
  const cardName = (await firstCard.locator("h3").first().innerText()).trim();
  await firstCard.locator("h3").first().click();
  await page.waitForTimeout(3000);
  const afterCard = page.url().split("#")[1] || "/";
  if (!/^\/products\/.+/.test(afterCard)) fail(`card click did not open Product Details (hash: ${afterCard})`);
  else ok(`card click → ${afterCard}`);
  const detailName = (await page.locator("h1").first().innerText().catch(() => "")).trim();
  if (detailName && cardName && !detailName.toLowerCase().includes(cardName.toLowerCase().split(" ")[0]))
    fail(`Product Details shows "${detailName}" but the card was "${cardName}"`);
  else ok(`Product Details shows "${detailName}"`);

  if (errors.length) fail(`page errors: ${JSON.stringify(errors.slice(0, 3))}`);
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nPASS: card parity, mobile and interactions" : `\nFAIL: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
