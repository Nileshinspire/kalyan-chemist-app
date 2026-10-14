// Quick diagnostic: ancestor chain of the overflowing Account referral card.
import { launch, go, assertPreview } from "./harness.mjs";
import { anonymousSignIn, injectSession } from "./authSession.mjs";

await assertPreview();
const WIDTH = Number(process.env.DIAG_W || 375);
const session = await anonymousSignIn();
const { browser, page } = await launch({ mobile: WIDTH < 1024 });
await page.setViewportSize({ width: WIDTH, height: 844 });
await go(page, "#/");
await injectSession(page, session);
await go(page, "#/account");
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const cards = [...document.querySelectorAll("div.rounded-xl")].filter((d) =>
    /Your Referral (Code|Link)/i.test(d.textContent || "")
  );
  const measure = (target) => {
    const r = target.getBoundingClientRect();
    const grid = target.parentElement;
    const gr = grid.getBoundingClientRect();
    const inner = [...target.querySelectorAll("button")].map((b) => {
      const br = b.getBoundingClientRect();
      return { txt: (b.textContent || "").trim().slice(0, 12), x: Math.round(br.x), right: Math.round(br.right), visible: br.right <= gr.right + 1 && br.width > 0 };
    });
    return {
      label: (target.textContent || "").replace(/\s+/g, " ").slice(0, 30),
      cardW: Math.round(r.width),
      gridW: Math.round(gr.width),
      gridRight: Math.round(gr.right),
      gridCols: getComputedStyle(grid).gridTemplateColumns,
      buttons: inner,
    };
  };
  const target = cards[0];
  if (!target) return { found: false, vw, scrollWidth: document.documentElement.scrollWidth };
  const chain = [];
  let el = target;
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    chain.push({
      tag: el.tagName,
      cls: String(el.className || "").slice(0, 90),
      w: Math.round(r.width),
      left: Math.round(r.left),
      overflowX: cs.overflowX,
      display: cs.display,
      gridCols: cs.gridTemplateColumns,
      minWidth: cs.minWidth,
    });
    el = el.parentElement;
  }
  // Which descendant forces the min-content width?
  const kids = [...target.querySelectorAll("*")].map((k) => {
    const r = k.getBoundingClientRect();
    const cs = getComputedStyle(k);
    return {
      tag: k.tagName,
      cls: String(k.className || "").slice(0, 60),
      txt: (k.textContent || "").replace(/\s+/g, " ").slice(0, 50),
      w: Math.round(r.width),
      sw: k.scrollWidth,
      ws: cs.whiteSpace,
      minW: cs.minWidth,
    };
  });
  return { found: true, vw, width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, cards: cards.map(measure), chain: chain.slice(0, 3) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
