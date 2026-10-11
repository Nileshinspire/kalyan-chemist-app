// Apollo Pharmacy mobile: card inner structure, banners, sticky-on-scroll behavior
// Usage: node qa/apollo-final.mjs [width]
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
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2000);

  const atTop = await page.evaluate(() => {
    const T = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
    const CL = (e) => (e.className || "").toString().replace(/\s+/g, " ").trim();

    // 1. Full inner structure of one product slide
    const slide = document.querySelector("[class*='slideCardRoot']");
    let slideStruct = null;
    if (slide) {
      const acc = [];
      const walk = (el, depth) => {
        if (depth > 7) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const cs = getComputedStyle(el);
        acc.push({
          d: depth,
          tag: el.tagName,
          cls: CL(el).slice(0, 34),
          w: Math.round(r.width),
          h: Math.round(r.height),
          fs: cs.fontSize,
          fw: cs.fontWeight,
          color: cs.color,
          bg: cs.backgroundColor.slice(0, 20),
          r: cs.borderRadius,
          t: T(el).slice(0, 44),
        });
        if (T(el) && el.children.length === 0) return; // leaf with text: stop
        [...el.children].slice(0, 6).forEach((c) => walk(c, depth + 1));
      };
      walk(slide, 0);
      slideStruct = acc;
    }

    // 2. Banner images (wide, short) with position
    const banners = [...document.querySelectorAll("img")]
      .map((i) => {
        const r = i.getBoundingClientRect();
        return {
          alt: i.alt,
          src: (i.currentSrc || i.src || "").slice(0, 110),
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top + window.scrollY),
        };
      })
      .filter((b) => b.w > 200 && b.h > 40 && b.h < 300);

    // 3. Floating/sticky elements state at scroll 0
    const floats = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return cs.position === "fixed" && r.width > 20 && r.height > 20;
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          cls: CL(e).slice(0, 50),
          text: T(e).slice(0, 70),
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
          html: (e.innerHTML || "").replace(/\s+/g, " ").slice(0, 200),
        };
      });

    // 4. Header + search position at scroll 0
    const header = document.querySelector("header");
    const searchRoot = document.querySelector("[class*='searchRoot']");
    const hdr = header ? header.getBoundingClientRect() : null;
    const sr = searchRoot ? searchRoot.getBoundingClientRect() : null;

    return {
      slideStruct,
      banners: banners.slice(0, 10),
      floats,
      atTop: {
        headerTop: hdr ? Math.round(hdr.top) : null,
        headerH: hdr ? Math.round(hdr.height) : null,
        searchTop: sr ? Math.round(sr.top) : null,
        searchH: sr ? Math.round(sr.height) : null,
      },
    };
  });

  // Scroll down 600px and re-check sticky states
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(900);
  const scrolled = await page.evaluate(() => {
    const T = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
    const CL = (e) => (e.className || "").toString().replace(/\s+/g, " ").trim();
    const header = document.querySelector("header");
    const searchRoot = document.querySelector("[class*='searchRoot']");
    const hdr = header ? header.getBoundingClientRect() : null;
    const sr = searchRoot ? searchRoot.getBoundingClientRect() : null;
    const floats = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return cs.position === "fixed" && r.width > 20 && r.height > 20;
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { cls: CL(e).slice(0, 50), text: T(e).slice(0, 60), y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) };
      });
    return {
      scrollY: window.scrollY,
      headerTop: hdr ? Math.round(hdr.top) : null,
      headerH: hdr ? Math.round(hdr.height) : null,
      searchTop: sr ? Math.round(sr.top) : null,
      searchVisible: sr ? sr.top > -sr.height && sr.top < window.innerHeight : false,
      floats,
    };
  });

  console.log(JSON.stringify({ width: WIDTH, atTop, scrolled }, null, 1));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
