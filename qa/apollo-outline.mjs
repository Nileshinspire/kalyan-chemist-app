// Apollo Pharmacy mobile homepage outline (document order)
// Usage: node qa/apollo-outline.mjs [width]
import { chromium } from "playwright-core";

const WIDTH = Number(process.argv[2] || 390);
const HEIGHT = 844;
const URL = "https://www.apollopharmacy.in/";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);
  // trigger lazy loading
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2000);

  const out = await page.evaluate(() => {
    const T = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
    const CL = (e) => (e.className || "").toString().replace(/\s+/g, " ").trim();

    // 1. All headings in document order
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, [class*='title'], [class*='Title'], [class*='heading'], [class*='Heading']")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const t = T(e);
        return r.width > 0 && r.height > 0 && t.length > 1 && t.length < 90 && e.offsetParent !== null;
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return {
          tag: e.tagName,
          cls: CL(e).slice(0, 50),
          text: T(e).slice(0, 80),
          top: Math.round(r.top + window.scrollY),
          size: cs.fontSize,
          weight: cs.fontWeight,
        };
      });
    // dedupe consecutive identical text
    const seen = new Set();
    const uniqHeadings = headings.filter((h) => {
      const k = h.tag + "|" + h.text;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // 2. Horizontal scroll rails (overflow-x)
    const rails = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return (
          r.width > 0 &&
          (cs.overflowX === "scroll" || cs.overflowX === "auto") &&
          e.scrollWidth > e.clientWidth + 10 &&
          e.clientWidth > 80
        );
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return {
          cls: CL(e).slice(0, 60),
          childCount: e.children.length,
          clientW: e.clientWidth,
          scrollW: e.scrollWidth,
          gap: cs.gap,
          pad: cs.paddingLeft + "/" + cs.paddingRight,
          pos: cs.position,
          top: Math.round(r.top + window.scrollY),
        };
      });

    // 3. Fixed/sticky elements
    const fixedEls = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return (cs.position === "fixed" || cs.position === "sticky") && r.width > 30 && r.height > 20;
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return {
          tag: e.tagName,
          cls: CL(e).slice(0, 50),
          text: T(e).slice(0, 60),
          pos: cs.position,
          top: Math.round(r.top),
          h: Math.round(r.height),
          z: cs.zIndex,
        };
      });

    // 4. Header structure (top level, 2 levels deep)
    const header = document.querySelector("header");
    const headerTree = [];
    if (header) {
      const walk = (el, depth) => {
        if (depth > 3) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        headerTree.push({
          depth,
          tag: el.tagName,
          cls: CL(el).slice(0, 44),
          text: T(el).slice(0, 70),
          w: Math.round(r.width),
          h: Math.round(r.height),
          pos: getComputedStyle(el).position,
        });
        if (depth < 3) [...el.children].slice(0, 8).forEach((c) => walk(c, depth + 1));
      };
      walk(header, 0);
    }

    // 5. Search area — look for search roots anywhere
    const searchRoots = [...document.querySelectorAll("[class*='search'], [class*='Search']")]
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          cls: CL(e).slice(0, 50),
          tag: e.tagName,
          text: T(e).slice(0, 80),
          w: Math.round(r.width),
          h: Math.round(r.height),
          inputs: e.querySelectorAll("input").length,
          top: Math.round(r.top + window.scrollY),
        };
      })
      .filter((x) => x.w > 0 && x.h > 0);

    // 6. Section spacing: direct children of main container with their vertical gaps
    const main = document.querySelector("#mainContainerCT") || document.querySelector("main") || document.body;
    const kids = [...main.children].map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return {
        tag: e.tagName,
        cls: CL(e).slice(0, 55),
        text: T(e).slice(0, 55),
        top: Math.round(r.top + window.scrollY),
        h: Math.round(r.height),
        mb: cs.marginBottom,
        pt: cs.paddingTop,
      };
    });

    return {
      docTitle: document.title,
      headings: uniqHeadings,
      rails,
      fixedEls,
      headerTree,
      searchRoots: searchRoots.slice(0, 12),
      mainChildren: kids.slice(0, 30),
      scrollH: document.body.scrollHeight,
      scrollW: document.documentElement.scrollWidth,
    };
  });

  console.log(JSON.stringify({ width: WIDTH, ...out }, null, 1));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
