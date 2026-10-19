// Diagnostic: for every product card on the homepage, report how many
// "% off" texts render inside it, where each one sits (image area vs price
// area), and the geometry of image / add-button / rating badge / price block.
import { launch, go, assertPreview, report } from "./harness.mjs";

await assertPreview();

const probe = () => {
  // Any element that is a leaf text carrier containing "<n>% off"
  const offEls = [...document.querySelectorAll("*")].filter((el) => {
    if (el.children.length > 0) return false;
    const t = (el.textContent || "").trim();
    return /^\d{1,3}\s*%\s*off$/i.test(t);
  });

  // Cards: the shared ProductCard root and the Hot Sellers inline card root
  const cards = [...document.querySelectorAll("[data-slot='card'], .kc-card-track .group")];
  const seen = new Set();
  const out = [];
  for (const card of cards) {
    if (seen.has(card)) continue;
    seen.add(card);
    const rect = card.getBoundingClientRect();
    if (rect.width < 80) continue;
    const nameEl = card.querySelector("h3");
    const offs = offEls
      .filter((el) => card.contains(el))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent.trim(),
          inImageArea: (() => {
            const img = card.querySelector("img, [class*='Pill'], svg.lucide-pill");
            const media = card.querySelector("div.relative.shrink-0, div.aspect-square");
            if (!media) return "no-media-found";
            const mr = media.getBoundingClientRect();
            return r.top < mr.bottom - 4 ? "ON/ABOVE-MEDIA-BOTTOM" : "below-media";
          })(),
          y: Math.round(r.y),
          cls: (el.className || "").toString().slice(0, 60),
        };
      });
    const img = card.querySelector("img");
    const addBtn = [...card.querySelectorAll("button")].find((b) => /^add$/i.test((b.textContent || "").trim()));
    const rating = card.querySelector("[aria-label^='Rated']");
    out.push({
      name: (nameEl?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
      cardRect: { w: Math.round(rect.width), h: Math.round(rect.height) },
      offCount: offs.length,
      offs,
      imgRect: img ? { w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height) } : null,
      addBtnRect: addBtn ? (() => { const r = addBtn.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; })() : null,
      ratingText: rating?.textContent?.trim() || null,
      fullText: (card.innerText || "").replace(/\n/g, " | ").slice(0, 260),
    });
  }
  return {
    url: location.hash,
    viewport: { w: innerWidth, h: innerHeight },
    totalOffOnPage: offEls.length,
    offTexts: offEls.map((e) => e.textContent.trim()),
    cardCount: out.length,
    cards: out.slice(0, 8),
  };
};

const { browser, page, pageErrors } = await launch();
await go(page, "#/");
await page.waitForTimeout(4000);
// Scroll through the whole page so lazy sections render.
await page.evaluate(async () => {
  const step = 600;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 200));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);
report("DESKTOP homepage cards", await page.evaluate(probe));

const mob = await launch({ mobile: true });
await go(mob.page, "#/");
await mob.page.waitForTimeout(4000);
await mob.page.evaluate(async () => {
  const step = 500;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 150));
  }
  window.scrollTo(0, 0);
});
await mob.page.waitForTimeout(1500);
report("MOBILE homepage cards", await mob.page.evaluate(probe));

console.log("pageErrors:", pageErrors.slice(0, 5));
await browser.close();
await mob.browser.close();
