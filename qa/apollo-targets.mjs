// Measure Apollo Pharmacy's mobile layout targets at 390x844.
// Run: node qa/apollo-targets.mjs
import { chromium } from "playwright-core";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
await page.goto("https://www.apollopharmacy.in/", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(6000);
// force-scroll to trigger lazy loads
await page.evaluate(async () => {
  const step = Math.round(window.innerHeight * 0.9);
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 800));
});

const out = await page.evaluate(() => {
  const res = { vw: document.documentElement.clientWidth };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const cs = (el, ...props) => {
    const s = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, s[p]]));
  };

  // ── header rows
  const header = document.querySelector("header");
  if (header) {
    res.header = { ...box(header), pos: getComputedStyle(header).position };
    res.headerRows = [...header.children].map((c) => ({
      tag: c.tagName.toLowerCase(),
      cls: String(c.className || "").slice(0, 50),
      ...box(c),
    }));
  }

  // ── hero: h1 + search + quick action cards
  const h1 = document.querySelector("h1");
  if (h1) res.h1 = { txt: h1.textContent.trim().slice(0, 50), ...box(h1), ...cs(h1, "fontSize", "fontWeight", "color", "textAlign") };
  const searchRoot = document.querySelector('[class*="searchRoot"]');
  if (searchRoot) {
    res.search = { ...box(searchRoot) };
    const inp = searchRoot.querySelector("input, [contenteditable], [class*='searchBar'], [class*='input']");
    if (inp) res.searchInput = { ...box(inp), ...cs(inp, "fontSize", "borderRadius", "height") };
  }

  // quick action cards: find the container right under the search block
  const quick = document.querySelector('[class*="prHome"], [class*="quickAction"]');
  if (quick) {
    res.quickWrap = { ...box(quick) };
    res.quickCards = [...quick.querySelectorAll("a, button")]
      .slice(0, 8)
      .map((a) => ({ txt: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30), ...box(a) }));
    const firstImg = quick.querySelector("img, svg, [class*='icon']");
    if (firstImg) res.quickIcon = box(firstImg);
  }

  // ── section headings: size + "View All" style
  const secs = [];
  const seen = new Set();
  for (const h of document.querySelectorAll("h2, [class*='sectionHeading']")) {
    const t = (h.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 40 || seen.has(t)) continue;
    seen.add(t);
    secs.push({ txt: t, ...box(h), ...cs(h, "fontSize", "fontWeight", "color") });
    if (secs.length >= 14) break;
  }
  res.headings = secs;

  // view-all links
  res.viewAll = [...document.querySelectorAll("a, button")]
    .filter((a) => /^view\s*all$/i.test((a.textContent || "").trim()))
    .slice(0, 5)
    .map((a) => ({ ...box(a), ...cs(a, "fontSize", "fontWeight", "color") }));

  // ── health-conditions tiles (icon grid under its heading)
  const condH = [...document.querySelectorAll("h2")].find((h) => /health condition/i.test(h.textContent || ""));
  if (condH) {
    const sec = condH.closest("section, div[class*='section'], [class*='Wrapper'], [class*='wrapper']");
    const grid = sec?.querySelector("div[class*='grid'], ul, [class*='Grid']");
    if (grid) {
      res.condGrid = { ...box(grid), ...cs(grid, "display", "gridTemplateColumns", "gap") };
      res.condTiles = [...grid.children].slice(0, 6).map((t) => ({
        txt: (t.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20),
        ...box(t),
      }));
      const tileImg = grid.querySelector("img, svg, [class*='icon'], [class*='Icon']");
      if (tileImg) res.condIcon = box(tileImg);
      const tileLbl = grid.querySelector("p, span, [class*='label'], [class*='Label']");
      if (tileLbl) res.condLabel = { ...box(tileLbl), ...cs(tileLbl, "fontSize", "fontWeight") };
    }
  }

  // ── product cards inside a carousel rail
  const rail = document.querySelector('[class*="keen-slider"], [class*="rail"], [class*="carousel"], [class*="Carousel"]');
  if (rail) {
    res.rail = { ...box(rail), ...cs(rail, "display", "gap", "overflowX") };
    res.railCards = [...rail.children].slice(0, 4).map((c) => box(c));
  }
  // generic product card anatomy (first card with an Add button)
  const addBtn = [...document.querySelectorAll("button")].find((b) => /^add$/i.test((b.textContent || "").trim()));
  if (addBtn) {
    const card = addBtn.closest('[class*="card"], [class*="Card"], div[class*="Product"], li, article');
    if (card) {
      res.card = { ...box(card) };
      res.addBtn = { ...box(addBtn), ...cs(addBtn, "fontSize", "fontWeight", "borderRadius", "background", "color") };
      const imgBox = card.querySelector("img")?.parentElement;
      if (imgBox) res.cardImageBox = { ...box(imgBox), ...cs(imgBox, "borderRadius", "border") };
      const price = [...card.querySelectorAll("*")].find((e) => /^₹\s?\d/.test((e.textContent || "").trim()) && e.children.length === 0);
      if (price) res.cardPrice = { ...box(price), ...cs(price, "fontSize", "fontWeight") };
      const name = card.querySelector("h3, h4, [class*='name'], [class*='Name']");
      if (name) res.cardName = { ...box(name), ...cs(name, "fontSize", "fontWeight") };
    }
  }

  // ── banners
  const banners = [...document.querySelectorAll("img")].map((i) => box(i)).filter((b) => b.w > 300 && b.h > 40 && b.h < 200);
  res.bannerStrips = banners.slice(0, 5);

  // ── fixed/sticky elements
  res.fixed = [...document.querySelectorAll("body *")]
    .map((el) => {
      const s = getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "sticky") return null;
      const b = box(el);
      if (!b.w || !b.h) return null;
      return { pos: s.position, tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 40), ...b, z: s.zIndex };
    })
    .filter(Boolean)
    .slice(0, 12);

  // section vertical rhythm: top-level sections
  res.sections = [...document.querySelectorAll("section, [class*='section'], [class*='Section']")]
    .map((s) => {
      const b = box(s);
      if (b.h < 60 || b.w < res.vw - 40) return null;
      const h = s.querySelector("h2");
      return { heading: h ? (h.textContent || "").trim().slice(0, 32) : "", ...b, padT: getComputedStyle(s).paddingTop, padB: getComputedStyle(s).paddingBottom };
    })
    .filter(Boolean)
    .slice(0, 16);

  return res;
});

console.log(JSON.stringify(out, null, 1));
await browser.close();
