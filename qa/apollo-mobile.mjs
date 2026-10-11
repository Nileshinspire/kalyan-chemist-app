// Apollo Pharmacy Mobile Layout Inspection
// Usage: node qa/apollo-mobile.mjs [width1 width2 ...]
// Prints a structured dump of the mobile view.
import { chromium } from "playwright-core";

const WIDTHS = process.argv.slice(2).map(Number);
const HEIGHT = 844;
const URL = "https://www.apollopharmacy.in/";

function elStr(el, maxLen = 300) {
  if (!el) return "null";
  const cls = (el.className || "").toString().trim();
  const id = el.id || "";
  const tag = el.tagName;
  const a = el.getAttribute("href") || "";
  const txt = (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  const attribs = [];
  if (el.tagName === "INPUT" || el.tagName === "BUTTON") {
    attribs.push(`type="${el.type || ""}"`, `placeholder="${el.getAttribute("placeholder") || ""}"`);
  }
  return `<${tag}${id ? ` id="${id}"` : ""}${cls ? ` class="${cls.slice(0, 60)}"` : ""}${a ? ` href="${a.slice(0, 80)}"` : ""}${attribs.length ? ` ${attribs.join(" ")}` : ""}>${txt ? ` "text=${txt}"` : ""}</${tag}>`;
}

async function dumpMobile(page, width) {    const out = await page.evaluate(() => {
    function elStr(el) {
      if (!el) return "null";
      const cls = (el.className || "").toString().trim();
      const id = el.id || "";
      const tag = el.tagName;
      const a = el.getAttribute("href") || "";
      const txt = (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 300);
      const attribs = [];
      if (el.tagName === "INPUT" || el.tagName === "BUTTON") {
        attribs.push(`type="${el.type || ""}"`, `placeholder="${el.getAttribute("placeholder") || ""}"`);
      }
      return `<${tag}${id ? ` id="${id}"` : ""}${cls ? ` class="${cls.slice(0, 60)}"` : ""}${a ? ` href="${a.slice(0, 80)}"` : ""}${attribs.length ? ` ${attribs.join(" ")}` : ""}>${txt ? ` "text=${txt}"` : ""}</${tag}>`;
    }
    const height = window.innerHeight || 844;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const $$ = (s) => [...document.querySelectorAll(s)];

    const header = document.querySelector("header, nav");
    const hero = document.querySelector("header.hero, .hero, header.hero-banner, .hero-banner, section.hero, div.hero, .hero-slider, .slides");
    const heroEl = hero ? hero : document.querySelector("header, .home-banner, .slider, .hero") || null;

    const topNav = document.querySelector("nav.top-nav, nav.navbar, nav.main-nav, header nav, .menu, .top-menu, ul.nav");
    const topNavItems = topNav ? $$(("a, li"), topNav).map((a) => (a.innerText || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24)) : [];
    const topNavLinks = topNav ? $$('a[href]', topNav).map((a) => ({ txt: (a.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24), href: (a.getAttribute("href") || "").slice(0, 60) })) : [];

    const search = document.querySelector("input[type='search'], input[placeholder*='Search'], input[placeholder*='search']");
    const searchBox = search
      ? {
          tag: search.tagName,
          cls: (search.className || "").toString().trim().slice(0, 50),
          placeholder: search.getAttribute("placeholder") || "",
          value: (search.value || "").slice(0, 40),
          visible: !search.closest(".hidden") && search.offsetParent !== null,
        }
      : null;

    // Sections: main sections with heading + first few items
    const sections = $$(("main > section, main > article, main > div")).map((sec) => {
      const h = sec.querySelector("h1, h2, h3, h4");
      const firstItems = [];
      const children = sec.children;
      for (let i = 0; i < Math.min(children.length, 6); i++) {
        const c = children[i];
        if (c.tagName && c.tagName !== "SCRIPT" && c.tagName !== "STYLE") {
          firstItems.push({ tag: c.tagName, cls: (c.className || "").toString().trim().slice(0, 40), txt: (c.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30) });
        }
      }
      const r = sec.getBoundingClientRect();
      return {
        tag: sec.tagName,
        cls: (sec.className || "").toString().trim().slice(0, 44),
        id: sec.id || "",
        h: h ? (h.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40) : "",
        first: firstItems,
        top: Math.round(r.top + window.scrollY),
        hght: Math.round(r.height),
      };
    });

    // Horizontal carousel / scroll containers
    const rails = $$(("div[class*='overflow'], ul[class*='overflow'], div[class*='scroll'], ul[class*='scroll']")).map((el) => {
      const cs = getComputedStyle(el);
      return {
        cls: (el.className || "").toString().trim().slice(0, 40),
        style: el.getAttribute("style") || "",
        overflowX: cs.overflowX,
        gap: cs.gap,
        display: cs.display,
        flexDirection: cs.flexDirection,
      };
    });

    // Product cards
    const cards = $$(("div[class*='card'], div[class*='product'], a[class*='card'], [class*='product-item']")).map((c) => {
      const img = c.querySelector("img");
      const pr = c.querySelector("span[class*='price'], div[class*='price'], .price, .mrp");
      return {
        cls: (c.className || "").toString().trim().slice(0, 40),
        txt: (c.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
        img: img ? (img.getAttribute("src") || img.getAttribute("data-src") || "").slice(0, 60) : "",
        price: pr ? (pr.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24) : "",
      };
    });

    // Prices & buttons
    const prices = $$(("span[class*='price'], div[class*='price'], .price, .mrp, .pay-now, .btn")).map((e) => (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24)).filter(Boolean);

    // Images
    const imgs = $$(("img")).map((i) => ({
      src: (i.getAttribute("src") || "").slice(0, 80),
      alt: i.getAttribute("alt") || "",
      complete: i.complete,
      w: i.naturalWidth,
      h: i.naturalHeight,
    }));

    // Bottom nav / mobile nav
    const bottomNav = document.querySelector(("nav[class*='bottom'], .bottom-nav, .mobile-nav, .bottom-tab, footer ul"));
    const bottomItems = bottomNav ? $$("a, button, li", bottomNav).map((e) => (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24)) : [];
    const bottomStyle = bottomNav ? getComputedStyle(bottomNav) : null;

    // Scroll horizontal overflow scan
    const overflow = [];
    $$(("body *")).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vw + 2 || r.left < -2) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed") return;
        let p = el.parentElement;
        let clipped = false;
        while (p && p !== document.body) {
          const pc = getComputedStyle(p);
          if (/(hidden|clip|auto|scroll)/.test(pc.overflowX)) { clipped = true; break; }
          p = p.parentElement;
        }
        if (clipped) return;
        overflow.push({ tag: el.tagName, cls: (el.className || "").toString().slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
      }
    });

    return {
      vw,
      vh,
      scrollW: document.documentElement.scrollWidth,
      bodyH: document.body.scrollHeight,
      header: header ? elStr(header) : "NO-HEADER",
      hero: heroEl ? elStr(heroEl) : "NO-HERO",
      topNav: topNav ? elStr(topNav) : "NO-TOPNAV",
      topNavItems: topNavItems.slice(0, 20),
      topNavLinks: topNavLinks.slice(0, 20),
      search: searchBox,
      sections: sections.slice(0, 24),
      rails: rails.slice(0, 8),
      cards: cards.slice(0, 20),
      prices: prices.slice(0, 15),
      imgs: imgs.slice(0, 12),
      bottomNav: bottomNav ? elStr(bottomNav) : "NO-BOTTOMNAV",
      bottomStyle: bottomStyle ? `${bottomStyle.position} ${bottomStyle.bottom} ${bottomStyle.left} ${bottomStyle.width}` : "none",
      overflow,
      inputCount: document.querySelectorAll("input").length,
    };
  });

  return { width, ...out };
}

async function main() {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    try {
      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      const info = await dumpMobile(page, width);
      console.log(`\n\n════════ WINDOW ${width}px x ${HEIGHT}px (mobile, touch) ═════════`);
      console.log(JSON.stringify(info, null, 2));
    } catch (e) {
      console.log(`\n\n════════ WINDOW ${width}px — ERROR: ${e.message} ═════════`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
