// Diagnostic 2: every "%" leaf text inside every homepage product card,
// with position relative to the media area, plus section attribution.
import { launch, go, assertPreview, report } from "./harness.mjs";

await assertPreview();

const probe = () => {
  const sectionHeading = (card) => {
    let el = card;
    while (el && el !== document.body) {
      const prev = el.previousElementSibling;
      const h = prev?.querySelector?.("h2") || el.parentElement?.querySelector?.("h2");
      const own = el.querySelector?.(":scope > div h2, :scope > h2");
      const t = (own?.textContent || h?.textContent || "").trim();
      if (t) return t.slice(0, 40);
      el = el.parentElement;
    }
    return "?";
  };

  const cards = [...document.querySelectorAll("[data-slot='card']")];
  const out = [];
  for (const card of cards) {
    const media = card.querySelector("div.relative.shrink-0");
    const mr = media?.getBoundingClientRect();
    const pctLeafs = [...card.querySelectorAll("*")].filter((el) => {
      if (el.children.length > 0) return false;
      return /%/.test(el.textContent || "");
    }).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || "").trim().slice(0, 20),
        pos: mr ? (r.top < mr.bottom - 2 ? "ON/OVER-MEDIA" : "below-media") : "?",
        y: Math.round(r.y),
        x: Math.round(r.x),
        cls: (el.className || "").toString().slice(0, 70),
        tag: el.tagName,
      };
    });
    const rect = card.getBoundingClientRect();
    if (rect.width < 60) continue;
    out.push({
      section: sectionHeading(card),
      name: (card.querySelector("h3")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 36),
      pctCount: pctLeafs.length,
      pctLeafs,
    });
  }
  return { viewport: { w: innerWidth }, totalCards: out.length, cards: out };
};

const { browser, page } = await launch();
await go(page, "#/");
await page.waitForTimeout(4000);
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 180));
  }
});
await page.waitForTimeout(2000);
const res = await page.evaluate(probe);
// Only print cards that contain a "%" text, plus a summary count.
const withPct = res.cards.filter((c) => c.pctCount > 0);
report("DESKTOP cards containing %", { totalCards: res.totalCards, cardsWithPct: withPct });

await browser.close();
