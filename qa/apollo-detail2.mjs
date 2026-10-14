// Apollo Pharmacy mobile detail: section rhythm, card anatomy, hero, fixed bars
// Usage: node qa/apollo-detail2.mjs [width]
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

    // 1. Children of the main home container: section rhythm
    const prHome = document.querySelector(".U3rIwG_prHome") || document.querySelector("#mainContainerCT");
    const sections = [];
    if (prHome) {
      let prevBottom = null;
      [...prHome.children].forEach((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        if (r.height === 0 && r.width === 0) return;
        const top = Math.round(r.top + window.scrollY);
        sections.push({
          cls: CL(e).slice(0, 60),
          text: T(e).slice(0, 60),
          top,
          h: Math.round(r.height),
          gapFromPrev: prevBottom === null ? null : top - prevBottom,
          pt: cs.paddingTop,
          pb: cs.paddingBottom,
        });
        prevBottom = top + Math.round(r.height);
      });
    }

    // 2. Inside a section-heading block: heading + rail layout
    const headingBlocks = [...document.querySelectorAll("[class*='sectionHeading']")].map((h) => {
      const sec = h.closest("div[class]") ? h.parentElement : h;
      const r = sec.getBoundingClientRect();
      return {
        heading: T(h).slice(0, 50),
        parentCls: CL(sec).slice(0, 55),
        h: Math.round(r.height),
        html: (h.parentElement.innerHTML || "").slice(0, 250),
      };
    });

    // 3. Product card anatomy — first card in Hot Sellers rail
    const rails = [...document.querySelectorAll("div, ul")]
      .filter((e) => {
        const cs = getComputedStyle(e);
        return (cs.overflowX === "scroll" || cs.overflowX === "auto") && e.scrollWidth > e.clientWidth + 20 && e.clientWidth > 100;
      })
      .map((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        const first = e.querySelector("a, [class*='card']");
        return {
          cls: CL(e).slice(0, 55),
          top: Math.round(r.top + window.scrollY),
          children: e.children.length,
          clientW: e.clientWidth,
          scrollW: e.scrollWidth,
          gap: cs.gap,
          firstCardCls: first ? CL(first).slice(0, 50) : "",
          firstCardW: first ? Math.round(first.getBoundingClientRect().width) : 0,
          firstCardH: first ? Math.round(first.getBoundingClientRect().height) : 0,
          firstCardText: first ? T(first).slice(0, 70) : "",
        };
      });

    // 4. Detailed anatomy of one product card (hot sellers area)
    let cardDetail = null;
    const anyCard = [...document.querySelectorAll("[class*='card']")].find((c) => {
      const t = T(c);
      return /₹/.test(t) && c.querySelector("img") && c.getBoundingClientRect().width > 80;
    });
    if (anyCard) {
      const walk = (el, depth, acc) => {
        if (depth > 4) return;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        acc.push({
          depth,
          tag: el.tagName,
          cls: CL(el).slice(0, 40),
          text: T(el).slice(0, 50),
          w: Math.round(r.width),
          h: Math.round(r.height),
          fs: cs.fontSize,
          bg: cs.backgroundColor.slice(0, 24),
          radius: cs.borderRadius,
          border: cs.border,
        });
        [...el.children].slice(0, 8).forEach((c) => walk(c, depth + 1, acc));
      };
      const acc = [];
      walk(anyCard, 0, acc);
      cardDetail = { rootCls: CL(anyCard), items: acc };
    }

    // 5. Hero cards (4 quick actions)
    const heroCards = [...document.querySelectorAll("a[class*='cardAnchorStyle']")].slice(0, 4).map((a) => {
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      return {
        text: T(a).slice(0, 60),
        href: (a.getAttribute("href") || "").slice(0, 70),
        w: Math.round(r.width),
        h: Math.round(r.height),
        bg: cs.backgroundImage.slice(0, 100) || cs.backgroundColor,
        radius: cs.borderRadius,
        img: a.querySelector("img") ? (a.querySelector("img").getAttribute("src") || "").slice(0, 90) : "",
        hasImg: !!a.querySelector("img"),
        top: Math.round(r.top + window.scrollY),
      };
    });

    // 6. Fixed elements full detail (incl width + whether visible at scroll 0)
    const fixed = [...document.querySelectorAll("body *")]
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
          cls: CL(e).slice(0, 55),
          text: T(e).slice(0, 80),
          pos: cs.position,
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
          bottom: cs.bottom,
          z: cs.zIndex,
        };
      });

    // 7. Section heading typography + "View all" / arrows
    const headingSample = [...document.querySelectorAll("[class*='sectionHeading']")].slice(0, 3).map((h) => {
      const cs = getComputedStyle(h);
      const sec = h.parentElement;
      const arrows = sec ? sec.querySelectorAll("button, [class*='arrow'], [class*='Arrow'], [class*='nav']").length : 0;
      return {
        text: T(h).slice(0, 40),
        fs: cs.fontSize,
        fw: cs.fontWeight,
        color: cs.color,
        jc: cs.justifyContent,
        parentCls: CL(sec).slice(0, 50),
        arrows: arrows,
      };
    });

    // 8. Body/base typography
    const bodyCs = getComputedStyle(document.body);
    const base = { font: bodyCs.fontFamily.slice(0, 80), fs: bodyCs.fontSize, bg: bodyCs.backgroundColor, color: bodyCs.color };

    // 9. Bottom footer quick links & app badges
    const footer = document.querySelector("footer, [class*='footer'], [class*='Footer']");
    const footerInfo = footer
      ? { cls: CL(footer).slice(0, 50), text: T(footer).slice(0, 300), h: Math.round(footer.getBoundingClientRect().height) }
      : null;

    return { sections, headingBlocks: headingBlocks.slice(0, 8), rails, cardDetail, heroCards, fixed, headingSample, base, footerInfo };
  });

  console.log(JSON.stringify({ width: WIDTH, ...out }, null, 1));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
