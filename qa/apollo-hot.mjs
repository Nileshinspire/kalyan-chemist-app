// Apollo Pharmacy: Hot Sellers section deep-dive + product card anatomy
// Usage: node qa/apollo-hot.mjs [width]
import { chromium } from "playwright-core";

const WIDTH = Number(process.argv[2] || 390);
const URL = "https://www.apollopharmacy.in/";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2500);

  const out = await page.evaluate(() => {
    const T = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
    const CL = (e) => (e.className || "").toString().replace(/\s+/g, " ").trim();

    // Find the Hot Sellers section heading, then dump its whole subtree geometry
    const h2 = [...document.querySelectorAll("h2")].find((h) => T(h) === "Hot Sellers");
    let hotTree = [];
    let hotCard = null;
    if (h2) {
      // climb to the section wrapper
      let sec = h2;
      for (let i = 0; i < 6 && sec.parentElement; i++) {
        sec = sec.parentElement;
        if (sec.querySelectorAll("img").length > 3) break;
      }
      const walk = (el, depth, acc) => {
        if (depth > 5) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        const cs = getComputedStyle(el);
        acc.push({
          depth,
          tag: el.tagName,
          cls: CL(el).slice(0, 42),
          text: T(el).slice(0, 46),
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top + window.scrollY),
          ox: cs.overflowX,
          disp: cs.display,
          gap: cs.gap,
        });
        [...el.children].slice(0, 6).forEach((c) => walk(c, depth + 1, acc));
      };
      walk(sec, 0, hotTree);

      // find a product card with price inside this section
      const card = [...sec.querySelectorAll("a, div")].find(
        (c) => /₹/.test(T(c)) && c.querySelector("img") && c.getBoundingClientRect().width > 90 && c.getBoundingClientRect().height > 100
      );
      if (card) {
        const acc = [];
        const walk2 = (el, depth) => {
          if (depth > 5) return;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          acc.push({
            depth,
            tag: el.tagName,
            cls: CL(el).slice(0, 40),
            text: T(el).slice(0, 55),
            w: Math.round(r.width),
            h: Math.round(r.height),
            fs: cs.fontSize,
            fw: cs.fontWeight,
            color: cs.color,
            bg: cs.backgroundColor.slice(0, 22),
            radius: cs.borderRadius,
            border: cs.border.slice(0, 40),
          });
          [...el.children].slice(0, 8).forEach((c) => walk2(c, depth + 1));
        };
        walk2(card, 0);
        hotCard = { cls: CL(card), items: acc };
      }
    }

    // All carousels: find containers whose children overflow horizontally
    const carousels = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width < 100 || r.height < 40) return false;
        const cs = getComputedStyle(e);
        // native scroll OR transform-swipe pattern
        if (cs.overflowX === "scroll" || cs.overflowX === "auto") {
          return e.scrollWidth > e.clientWidth + 20;
        }
        return false;
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return {
          cls: CL(e).slice(0, 55),
          top: Math.round(r.top + window.scrollY),
          clientW: e.clientWidth,
          scrollW: e.scrollWidth,
          kids: e.children.length,
          gap: cs.gap,
          snap: cs.scrollSnapType,
        };
      });

    // Product card count + typical card width across page
    const priceCards = [...document.querySelectorAll("a, div")].filter((c) => {
      const r = c.getBoundingClientRect();
      return /₹\s?\d/.test(T(c)) && c.querySelector("img") && r.width > 80 && r.height > 100 && r.width < 300;
    });
    const cardSizes = priceCards.slice(0, 40).map((c) => {
      const r = c.getBoundingClientRect();
      return Math.round(r.width) + "x" + Math.round(r.height);
    });

    // View All link style
    const viewAll = document.querySelector("[class*='viewAllText']");
    const vaStyle = viewAll
      ? (() => {
          const cs = getComputedStyle(viewAll);
          return { fs: cs.fontSize, color: cs.color, fw: cs.fontWeight, text: T(viewAll) };
        })()
      : null;

    // Health-condition grid: item size
    const condItem = [...document.querySelectorAll("h3")].find((h) => T(h) === "Diabetes Care");
    let condGrid = null;
    if (condItem) {
      const box = condItem.closest("a, li, div");
      const r = box.getBoundingClientRect();
      const img = box.querySelector("img");
      condGrid = {
        itemW: Math.round(r.width),
        itemH: Math.round(r.height),
        imgW: img ? Math.round(img.getBoundingClientRect().width) : 0,
        imgH: img ? Math.round(img.getBoundingClientRect().height) : 0,
        hasImg: !!img,
        parentCls: CL(box.parentElement).slice(0, 50),
        parentDisplay: getComputedStyle(box.parentElement).display,
        parentWrap: getComputedStyle(box.parentElement).flexWrap,
        parentGap: getComputedStyle(box.parentElement).gap,
      };
    }

    return { hotTree: hotTree.slice(0, 45), hotCard, carousels, cardCount: priceCards.length, cardSizes, vaStyle, condGrid };
  });

  console.log(JSON.stringify({ width: WIDTH, ...out }, null, 1));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
