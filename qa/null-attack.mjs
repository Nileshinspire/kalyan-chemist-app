import { chromium } from "playwright-core";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("https://sunny-baths-help.freebuff.dev/products", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
const r = await page.evaluate(() => {
  const grid = document.querySelector(".kc-products-grid");
  const out = { exists: !!grid, gridW: grid?.getBoundingClientRect().width };
  if (grid) {
    const first = grid.querySelector("div");
    if (first) {
      const rr = first.getBoundingClientRect();
      out.cardW = Math.round(rr.width);
      out.cardH = Math.round(rr.height);
    }
    const imgs = grid.querySelectorAll("img");
    if (imgs.length) {
      const ir = imgs[0].getBoundingClientRect();
      out.imgW = Math.round(ir.width);
      out.imgH = Math.round(ir.height);
    }
  }
  return out;
});
console.log("RESULT", JSON.stringify(r));
await browser.close();
