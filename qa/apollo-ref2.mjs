// Apollo Pharmacy mobile reference: full product card geometry.
// Usage: node qa/apollo-ref2.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SHOTS = join(process.cwd(), "qa/shots");
mkdirSync(SHOTS, { recursive: true });
const URL = "https://www.apollopharmacy.in/shop-by-health-conditions/diabetic";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const out = {};
for (const w of [360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(6000);
    await page.evaluate(async () => {
      for (let y = 0; y < 3000; y += 600) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 800));
    });
    out[w] = await page.evaluate(() => {
      const B = (el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) };
      };
      const addBtns = [...document.querySelectorAll("button")].filter((b) => /^add$/i.test((b.textContent || "").trim()));
      const cards = [];
      for (const btn of addBtns.slice(0, 4)) {
        let node = btn;
        for (let i = 0; i < 8 && node.parentElement; i++) {
          node = node.parentElement;
          const r = node.getBoundingClientRect();
          if (r.width > innerWidth * 0.95) break;
          if (/₹/.test(node.textContent || "") && node.querySelector("img")) break;
        }
        const img = node.querySelector("img");
        const imgr = img ? img.getBoundingClientRect() : null;
        cards.push({
          card: B(node),
          btn: B(btn),
          img: imgr ? { w: Math.round(imgr.width), h: Math.round(imgr.height), top: Math.round(imgr.top - node.getBoundingClientRect().top), left: Math.round(imgr.left - node.getBoundingClientRect().left), natural: `${img.naturalWidth}x${img.naturalHeight}`, fit: getComputedStyle(img).objectFit } : null,
          text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
        });
      }
      return { vw: innerWidth, scrollW: document.documentElement.scrollWidth, cards };
    });
    await page.screenshot({ path: join(SHOTS, `apollo-ref2-${w}.png`) });
  } catch (e) {
    out[w] = { error: String(e).slice(0, 200) };
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
