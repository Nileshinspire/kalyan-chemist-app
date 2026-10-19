// Universal card probe: finds EVERY card-like container on a page (shared
// ProductCard via data-slot=card, PLUS hand-rolled section cards that contain
// an h3 + an Add/Buy button). Reports all "%" leaf texts and whether each sits
// over/above the media bottom edge or below it.
// Usage: node qa/diag-all-cards.mjs [host] [route] [width]
import { chromium } from "playwright-core";

const HOST = process.argv[2] || "https://sunny-baths-help.freebuff.dev";
const ROUTE = process.argv[3] || "#/";
const WIDTH = Number(process.argv[4] || 1440);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });
await page.goto(`${HOST}/${ROUTE}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 500) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 150));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(2500);

const res = await page.evaluate(() => {
  // A "card" = data-slot=card, OR a div that has both an h3 and a button
  // whose text is Add/Add to Cart/Buy Now/Cart/Sold out.
  const all = [...document.querySelectorAll("div")];
  const isCard = (el) => {
    if (el.getAttribute?.("data-slot") === "card") return true;
    if (!el.querySelector(":scope > h3, :scope > div > h3")) return false;
    const btns = [...el.querySelectorAll("button")].map((b) => (b.textContent || "").trim());
    return btns.some((t) => /^(add|add to cart|buy now|cart|sold out|out of stock)$/i.test(t));
  };
  const cards = all.filter((el) => {
    if (!isCard(el)) return false;
    // exclude containers that merely wrap other cards (keep deepest match)
    return ![...el.querySelectorAll("div")].some((d) => d !== el && isCard(d) && el.contains(d) && d.querySelector("h3") === el.querySelector("h3"));
  });
  const seen = new Set();
  const out = [];
  for (const card of cards) {
    const h3 = card.querySelector("h3");
    if (!h3 || seen.has(h3)) continue;
    seen.add(h3);
    const rect = card.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 80) continue;
    // media = the container of the product img (aspect-square / rounded white box)
    const img = card.querySelector("img");
    let media = null;
    if (img) {
      media = img.closest("div[class*='aspect-square'], div[class*='relative flex']") || img.parentElement;
    }
    const mr = media?.getBoundingClientRect();
    const pcts = [...card.querySelectorAll("*")]
      .filter((el) => el.children.length === 0 && /%/.test(el.textContent || ""))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (el.textContent || "").trim().slice(0, 18),
          zone: mr
            ? r.top < mr.bottom - 2
              ? r.bottom > mr.top
                ? "OVER-MEDIA-EDGE"
                : "ABOVE-MEDIA"
              : "below-media"
            : "?",
          cls: (el.className?.baseVal ?? el.className ?? "").toString().slice(0, 64),
        };
      });
    // section heading: nearest preceding h2 in the document
    let h2 = null;
    let n = card;
    while (n && !h2) {
      let sib = n.previousElementSibling;
      while (sib && !h2) {
        h2 = sib.querySelector?.("h2") || (sib.tagName === "H2" ? sib : null);
        sib = sib.previousElementSibling;
      }
      n = n.parentElement;
    }
    out.push({
      section: (h2?.textContent || "?").replace(/\s+/g, " ").trim().slice(0, 34),
      name: (h3.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34),
      pctCount: pcts.length,
      pcts,
    });
  }
  return { url: location.href, vw: innerWidth, cards: out };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
