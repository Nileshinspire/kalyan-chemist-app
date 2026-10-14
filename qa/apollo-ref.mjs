// Apollo Pharmacy mobile reference: measure a product card's box, image area
// and image fit at several mobile widths.
// Usage: node qa/apollo-ref.mjs
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
      for (let y = 0; y < 4000; y += 600) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 800));
    });
    out[w] = await page.evaluate(() => {
      const B = (el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left) };
      };
      // Apollo product cards are anchors around an <img> plus an Add button.
      const imgs = [...document.querySelectorAll("img")]
        .filter((i) => {
          const r = i.getBoundingClientRect();
          return r.width > 40 && r.height > 40 && r.top > 200;
        })
        .slice(0, 6);
      const cards = imgs.map((img) => {
        let node = img;
        for (let i = 0; i < 6 && node.parentElement; i++) {
          node = node.parentElement;
          if (/add|cart/i.test((node.querySelector("button")?.textContent || "")) && node.getBoundingClientRect().width < innerWidth) break;
        }
        const cs = getComputedStyle(img);
        return {
          card: B(node),
          img: { ...B(img), fit: cs.objectFit, natural: `${img.naturalWidth}x${img.naturalHeight}` },
          text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70),
        };
      });
      return { vw: innerWidth, scrollW: document.documentElement.scrollWidth, cards };
    });
    await page.screenshot({ path: join(SHOTS, `apollo-ref-${w}.png`) });
  } catch (e) {
    out[w] = { error: String(e).slice(0, 200) };
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
