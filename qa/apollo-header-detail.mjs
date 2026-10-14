// Header detail for Apollo Pharmacy at 390px
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
      const header = document.querySelector("header");
      const inputs = $$("input").map((i) => ({
        tag: i.tagName,
        cls: (i.className || "").toString().trim().slice(0, 40),
        ph: i.getAttribute("placeholder") || "",
        type: i.type || "",
        vis: !i.closest(".hidden") && i.offsetParent !== null,
      }));
      const forms = $$("form").map((f) => ({
        cls: (f.className || "").toString().trim().slice(0, 40),
        action: f.getAttribute("action") || "",
        children: f.children.length,
      }));
      const rails = $$("div[class*='overflow'], ul[class*='overflow'], div[class*='scroll'], ul[class*='scroll'], ol[class*='scroll']").map((el) => {
        const cs = getComputedStyle(el);
        return {
          cls: (el.className || "").toString().trim().slice(0, 40),
          overflowX: cs.overflowX,
          gap: cs.gap,
          display: cs.display,
          flexDir: cs.flexDirection,
          children: el.children.length,
        };
      });
      const anchors = $$("a.cardAnchorStyle, a[class*='card'], div[class*='card']").map((a) => ({
        cls: (a.className || "").toString().trim().slice(0, 40),
        txt: (a.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
        href: a.getAttribute("href") || "",
        img: a.querySelector("img") ? (a.querySelector("img").getAttribute("src") || "").slice(0, 50) : "",
      }));
      const heroBan = document.querySelector("div[class*='hero'], section[class*='hero'], header[class*='hero']");
      return {
        header: header ? header.outerHTML.slice(0, 900) : "NO-HEADER",
        inputs,
        forms,
        rails: rails.slice(0, 8),
        anchors: anchors.slice(0, 10),
        heroBanner: heroBan ? (heroBan.className || "").toString().slice(0, 40) : "NO-HERO",
      };
    });
    console.log(JSON.stringify(info, null, 2));
  } catch (e) {
    console.error("ERROR:", e.message);
  } finally {
    await browser.close();
  }
})();
