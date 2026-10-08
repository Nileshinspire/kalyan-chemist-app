import { launch, go, assertPreview } from "./harness.mjs";
await assertPreview();
const { browser, page } = await launch({ mobile: true });
await page.setViewportSize({ width: 375, height: 844 });
await go(page, "#/");
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const sections = [...document.querySelectorAll("section")];
  const s = sections.find((el) => /New Arrivals/i.test(el.querySelector("h2")?.textContent || ""));
  if (!s) return { found: false };
  const r = s.getBoundingClientRect();
  const header = s.querySelector("h2")?.parentElement?.parentElement;
  const track = s.querySelector("[class*='overflow-x-auto']");
  const card = s.querySelector(".kc-new-arrival");
  const imgBand = card?.querySelector("[class*='h-32'], [class*='h-44']");
  const cs = imgBand ? getComputedStyle(imgBand) : null;
  return {
    sectionH: Math.round(r.height),
    headerH: header ? Math.round(header.getBoundingClientRect().height) : null,
    trackH: track ? Math.round(track.getBoundingClientRect().height) : null,
    cardW: card ? Math.round(card.getBoundingClientRect().width) : null,
    cardH: card ? Math.round(card.getBoundingClientRect().height) : null,
    imgBandH: cs ? cs.height : null,
    imgBandClass: imgBand?.className.slice(0, 90),
    cardParts: card
      ? [...card.querySelectorAll("*")].slice(0, 24).map((e) => ({
          tag: e.tagName, cls: String(e.className || "").slice(0, 55),
          h: Math.round(e.getBoundingClientRect().height),
        })).filter((x) => x.h > 0)
      : [],
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
