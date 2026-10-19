// Apollo-hierarchy geometry verification for the shared product card.
// Asserts, per rendered card, in DOM order:
//   media box -> (rating pill straddling media lower-left) -> (Add button
//   beside/below media right) -> attributes -> name -> manufacturer ->
//   delivery -> MRP+single % -> price, and that nothing renders "%" over media.
import { launch, go, assertPreview, report } from "./harness.mjs";

await assertPreview();

const probe = () => {
  const cards = [...document.querySelectorAll("[data-slot='card']")].filter(
    (c) => c.getBoundingClientRect().width > 80
  );
  return cards.slice(0, 6).map((card) => {
    const media = card.querySelector("div.relative.shrink-0 > div");
    const mr = media?.getBoundingClientRect();
    const rating = card.querySelector("[aria-label^='Rated']");
    const addBtn = [...card.querySelectorAll("button")].find((b) => /^add$/i.test((b.textContent || "").trim()));
    const ar = addBtn?.getBoundingClientRect();
    const h3 = card.querySelector("h3");
    const attr = h3?.parentElement?.querySelector("p");
    const paragraphs = [...card.querySelectorAll("p")].map((p) => (p.textContent || "").trim().slice(0, 28));
    const pctOverMedia = [...card.querySelectorAll("*")].some((el) => {
      if (el.children.length || !/%/.test(el.textContent || "")) return false;
      const r = el.getBoundingClientRect();
      return mr ? r.top < mr.bottom - 2 : false;
    });
    const priceBlock = [...card.querySelectorAll("div")].find((d) => /MRP/.test(d.textContent || "") && d.querySelector(".line-through"));
    return {
      name: (h3?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24),
      media: mr ? { w: Math.round(mr.width), h: Math.round(mr.height), bottom: Math.round(mr.bottom) } : null,
      rating: rating ? (() => { const r = rating.getBoundingClientRect(); return { text: rating.textContent.trim().slice(0, 12), x: Math.round(r.x), bottom: Math.round(r.bottom), straddlesMediaBottom: Math.abs(r.bottom - (mr?.bottom || 0)) < 14 }; })() : null,
      addBtn: ar ? { x: Math.round(ar.x), w: Math.round(ar.width), h: Math.round(ar.height), visible: ar.width > 0 && getComputedStyle(addBtn).display !== "none", besideMediaRight: mr ? ar.x >= mr.right - 30 : null, straddlesMediaBottom: mr ? Math.abs(ar.bottom - mr.bottom) < 20 : null } : null,
      order: {
        attrBelowMedia: mr && attr ? Math.round(attr.getBoundingClientRect().top) >= Math.round(mr.bottom) - 2 : null,
        nameBelowAttr: mr && attr && h3 ? h3.getBoundingClientRect().top >= attr.getBoundingClientRect().top : null,
      },
      paragraphs,
      mrpLine: priceBlock ? (priceBlock.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) : null,
      pctOverMedia,
    };
  });
};

const { browser, page } = await launch();
await go(page, "#/");
await page.waitForTimeout(4000);
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 150));
  }
});
await page.waitForTimeout(1500);
report("DESKTOP card geometry (Apollo hierarchy)", await page.evaluate(probe));

const mob = await launch({ mobile: true });
await go(mob.page, "#/");
await mob.page.waitForTimeout(4000);
await mob.page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 500) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 120));
  }
});
await mob.page.waitForTimeout(1500);
report("MOBILE card geometry", await mob.page.evaluate(probe));

await browser.close();
await mob.browser.close();
