import { chromium } from "playwright-core";
const URL = "https://www.apollopharmacy.in/";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const $ = (s) => document.querySelector(s);
      const $$ = (s) => [...document.querySelectorAll(s)];
      // Hero banner search: find any input that is not a checkbox inside header
      const allInputs = $$("input").map((i) => ({
        cls: (i.className || "").toString().trim().slice(0, 40),
        ph: i.getAttribute("placeholder") || "",
        type: i.type || "",
        parent: i.closest("header") ? "header" : (i.closest(".hero") ? "hero" : (i.closest("form") ? "form" : "other")),
        vis: !i.closest(".hidden") && i.offsetParent !== null,
      }));
      // hero banner
      const hero = document.querySelector("div[class*='hero'], section[class*='hero'], div[class*='home-hero'], div[class*='hero-banner']");
      const heroChildInputs = hero ? $$("input", hero).map((i) => ({ ph: i.getAttribute("placeholder") || "", cls: (i.className || "").toString().trim().slice(0, 40) })) : [];
      // product cards with image src
      const cards = $$("a[class*='card'], div[class*='card']").map((c) => {
        const img = c.querySelector("img");
        return {
          cls: (c.className || "").toString().trim().slice(0, 40),
          txt: (c.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30),
          img: img ? (img.getAttribute("src") || "").slice(0, 50) : "",
          w: img ? img.naturalWidth : 0,
          h: img ? img.naturalHeight : 0,
          rating: c.querySelector("[class*='rating']") ? (c.querySelector("[class*='rating']").innerText || "").slice(0, 10) : "",
        };
      });
      // Rating stars / reviews
      const ratings = $$("[class*='rating'], [class*='stars']").map((r) => (r.innerText || "").replace(/\s+/g, " ").trim().slice(0, 20));
      // carousel arrows / dots
      const controls = $$("[class*='arrow'], [class*='dot'], [class*='nav']").map((c) => (c.innerText || c.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 20));
      return {
        inputs: allInputs,
        heroInput: heroChildInputs,
        hero: hero ? (hero.className || "").toString().slice(0, 40) : "NO-HERO",
        cards: cards.slice(0, 12),
        ratings: ratings.slice(0, 8),
        controls: controls.slice(0, 8),
      };
    });
    console.log(JSON.stringify(info, null, 2));
  } catch (e) {
    console.error("ERROR:", e.message);
  } finally {
    await browser.close();
  }
})();
