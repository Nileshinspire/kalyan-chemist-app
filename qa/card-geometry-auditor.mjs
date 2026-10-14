import { launch, go, assertPreview } from "./harness.mjs";

const WIDTH = Number(process.env.DIAG_W || 1440);
const HEIGHT = Number(process.env.DIAG_H || 900);

(async () => {
  await assertPreview();
  const { browser, page } = await launch();
  try {
    await page.setViewportSize({ width: WIDTH, height: HEIGHT });
    await go(page, "products");
    await page.waitForTimeout(4000);

    const desktop = await page.evaluate(() => {
      const grid = document.querySelector(".kc-products-grid");
      const out = { gridWidth: 0, cardWidth: 0, cardHeight: 0, imageWidth: 0, imageHeight: 0, cards: [] };
      if (!grid) return out;
      out.gridWidth = Math.round(grid.getBoundingClientRect().width);
      const first = grid.querySelector("div");
      if (first) {
        const r = first.getBoundingClientRect();
        out.cardWidth = Math.round(r.width);
        out.cardHeight = Math.round(r.height);
        const img = first.querySelector("img");
        if (img) {
          const ir = img.getBoundingClientRect();
          out.imageWidth = Math.round(ir.width);
          out.imageHeight = Math.round(ir.height);
        }
      }
      [...grid.querySelectorAll("div.kc-products-grid > div")].forEach((c, i) => {
        const r = c.getBoundingClientRect();
        out.cards.push({ i, w: Math.round(r.width), h: Math.round(r.height) });
      });
      return out;
    });

    const mobile = await page.evaluate(() => {
      const grid = document.querySelector(".kc-products-grid");
      const card =
        grid?.querySelector("div[data-slot] > div") ||
        [...document.querySelectorAll("div.kc-products-grid > div")][0];
      const out = { gridWidth: 0, cardWidth: 0, cardHeight: 0, imageWidth: 0, imageHeight: 0 };
      if (!grid) return out;
      out.gridWidth = Math.round(grid.getBoundingClientRect().width);
      if (card) {
        const r = card.getBoundingClientRect();
        out.cardWidth = Math.round(r.width);
        out.cardHeight = Math.round(r.height);
        const img = card.querySelector("img");
        if (img) {
          const ir = img.getBoundingClientRect();
          out.imageWidth = Math.round(ir.width);
          out.imageHeight = Math.round(ir.height);
        }
      }
      return out;
    });

    console.log("WIDTH=" + WIDTH);
    console.log("desktop  : grid=" + desktop.gridWidth + " card=" + desktop.cardWidth + "x" + desktop.cardHeight + " image=" + desktop.imageWidth + "x" + desktop.imageHeight);
    console.log("mobile   : grid=" + mobile.gridWidth + " card=" + mobile.cardWidth + "x" + mobile.cardHeight + " image=" + mobile.imageWidth + "x" + mobile.imageHeight);
    console.log("cards    : " + JSON.stringify(desktop.cards.slice(0, 6)));
  } finally {
    await browser.close();
  }
})();
