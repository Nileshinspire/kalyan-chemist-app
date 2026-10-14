import { launch, go } from "./harness.mjs";

const GRID_CSS = [
  ".kc-products-grid .h-30, .kc-products-grid .sm\\:h-30 { height: 7.5rem; }",
  ".kc-products-grid .sm\\:p-2.5 { padding: 0.625rem; }",
  ".kc-products-grid .p-2.5, .kc-products-grid .sm\\:p-2.5 { padding: 0.625rem; }",
  ".kc-products-grid .space-y-1.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.375rem; }",
  ".kc-products-grid .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }",
  ".kc-products-grid .text-[14px] { font-size: 0.875rem; }",
  ".kc-products-grid .text-sm { font-size: 0.8125rem; }",
  ".kc-products-grid .text-xs { font-size: 0.6875rem; }",
  ".kc-products-grid .text-[13px] { font-size: 0.8125rem; }",
  ".kc-products-grid .text-[11px] { font-size: 0.75rem; }",
  ".kc-products-grid .text-base { font-size: 0.9375rem; }",
  ".kc-products-grid .text-[10px] { font-size: 0.625rem; }",
  ".kc-products-grid .h-7 { height: 1.75rem; }",
  ".kc-products-grid .h-8 { height: 1.625rem; }",
  ".kc-products-grid .h-9 { height: 1.625rem; }",
  ".kc-products-grid .w-7 { width: 1.75rem; }",
  ".kc-products-grid .w-8 { width: 1.625rem; }",
  ".kc-products-grid button.text-xs { font-size: 0.75rem; }",
  ".kc-products-grid .gap-1.5 { gap: 0.375rem; }",
  ".kc-products-grid .gap-1 { gap: 0.25rem; }",
  ".kc-products-grid .gap-2 { gap: 0.375rem; }",
].join("\n");

(async () => {
  const { browser, page } = await launch();
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await go(page, "products");
    await page.waitForTimeout(6000);

    const out = await page.evaluate((gridCss) => {
      const grid = document.querySelector(".kc-products-grid");
      const card = grid?.querySelector("div[data-slot=\"card\"]");
      const band = card?.querySelector("div.relative.flex");
      const img = card?.querySelector("img");
      const btns = card?.querySelectorAll("button");
      const gridStyle = window.getComputedStyle(grid);
      const cardStyle = card ? window.getComputedStyle(card) : null;
      const imgStyle = img ? window.getComputedStyle(img) : null;
      const cardRect = card ? card.getBoundingClientRect() : null;
      const bandRect = band ? band.getBoundingClientRect() : null;
      const imgRect = img ? img.getBoundingClientRect() : null;
      const btnsArr = Array.from(btns || []).map(b => {
        const r = b.getBoundingClientRect();
        return { cls: String(b.className).slice(0, 60), h: Math.round(r.height), w: Math.round(r.width) };
      });
      return {
        gridExists: !!grid,
        gridWidth: grid ? Math.round(grid.getBoundingClientRect().width) : 0,
        gridGap: gridStyle.getPropertyValue("gap"),
        gridCols: gridStyle.getPropertyValue("grid-template-columns"),
        card: card ? {
          width: Math.round(cardRect.width),
          height: Math.round(cardRect.height),
          padding: cardStyle ? `${cardStyle.paddingTop} ${cardStyle.paddingRight} ${cardStyle.paddingBottom} ${cardStyle.paddingLeft}` : null,
          gap: cardStyle ? cardStyle.columnGap : null,
          gridGap: cardStyle ? gridStyle.getPropertyValue("grid-gap") : null,
        } : null,
        band: band ? {
          height: Math.round(bandRect.height),
          width: Math.round(bandRect.width),
          aspectRatio: bandStyle ? bandStyle.getPropertyValue("aspect-ratio") : null,
          objectFit: imgStyle ? imgStyle.getPropertyValue("object-fit") : null,
          overflow: imgStyle ? imgStyle.getPropertyValue("overflow") : null,
        } : null,
        img: img ? {
          width: Math.round(imgRect.width),
          height: Math.round(imgRect.height),
          objectFit: imgStyle ? imgStyle.getPropertyValue("object-fit") : null,
          src: img.getAttribute("src") || null,
        } : null,
        buttons: btnsArr,
        cardHeightPerCard: card ? Math.round(cardRect.height) : 0,
      };
    }, GRID_CSS);
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
