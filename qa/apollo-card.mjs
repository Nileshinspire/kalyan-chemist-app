// Apollo mobile: product card innerHTML + sticky header on real scroll
// Usage: node qa/apollo-card.mjs [width]
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
  await page.waitForTimeout(4500);

  const card = await page.evaluate(() => {
    const slide = document.querySelector("[class*='slideCardRoot']");
    if (!slide) return null;
    // clone + strip images srcs for brevity
    const clone = slide.cloneNode(true);
    clone.querySelectorAll("img").forEach((i) => {
      i.setAttribute("src", (i.getAttribute("src") || i.getAttribute("data-src") || "IMG").slice(0, 70));
    });
    return clone.outerHTML.replace(/\s+/g, " ").slice(0, 3000);
  });

  // Real scroll via mouse wheel, then measure sticky states
  await page.mouse.move(WIDTH / 2, 400);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1200);
  const scrolled = await page.evaluate(() => {
    const T = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
    const CL = (e) => (e.className || "").toString().replace(/\s+/g, " ").trim();
    const header = document.querySelector("header");
    const search = document.querySelector("[class*='searchRoot']");
    const navRoot = document.querySelector("ul[class*='navRoot']");
    const g = (e) => (e ? (() => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { y: Math.round(r.top), h: Math.round(r.height), pos: cs.position, vis: cs.visibility, disp: cs.display }; })() : null);
    return {
      scrollY: Math.round(window.scrollY),
      header: g(header),
      search: g(search),
      navRoot: g(navRoot),
      fixedNow: [...document.querySelectorAll("body *")].filter((e) => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        return cs.position === "fixed" && r.width > 20 && r.height > 20;
      }).map((e) => { const r = e.getBoundingClientRect(); return { cls: CL(e).slice(0, 46), y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), text: T(e).slice(0, 50) }; }),
    };
  });

  console.log(JSON.stringify({ width: WIDTH, card, scrolled }, null, 1));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
