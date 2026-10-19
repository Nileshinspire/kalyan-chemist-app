// Visual verification: screenshots of product cards at desktop + mobile,
// plus a duplicate-discount scan on every product-listing route.
import { launch, go, assertPreview, report } from "./harness.mjs";

await assertPreview();

const scan = () => {
  const pctLeafs = [...document.querySelectorAll("*")].filter(
    (el) => el.children.length === 0 && /%\s*(off)?/i.test(el.textContent || "") && /%/.test(el.textContent || "")
  );
  const items = pctLeafs.map((el) => {
    const t = (el.textContent || "").trim();
    // find nearest card ancestor
    let n = el.parentElement;
    let card = null;
    while (n && n !== document.body) {
      if (n.querySelector?.("h3")) { card = n; break; }
      n = n.parentElement;
    }
    const cardName = card ? (card.querySelector("h3")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30) : "(page-level)";
    return { text: t.slice(0, 20), card: cardName, cls: (el.className?.baseVal ?? el.className ?? "").toString().slice(0, 50) };
  });
  // group by card name
  const byCard = {};
  for (const it of items) {
    if (it.card === "(page-level)") continue;
    byCard[it.card] = byCard[it.card] || [];
    byCard[it.card].push(it.text);
  }
  const duplicates = Object.entries(byCard).filter(([, v]) => v.length > 1);
  return { route: location.hash, pctByCard: byCard, duplicateCards: duplicates };
};

const routes = ["#/", "#/products", "#/value-deals", "#/hot-sellers"];
const { browser, page } = await launch();

for (const r of routes) {
  await go(page, r);
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((res) => setTimeout(res, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
  report(`scan ${r}`, await page.evaluate(scan));
}

// Screenshots of homepage sections (desktop)
await go(page, "#/");
await page.waitForTimeout(3500);
const sections = await page.locator("section").all();
let idx = 0;
for (const s of sections) {
  const txt = (await s.innerText().catch(() => "")).slice(0, 60).replace(/\n/g, " ");
  if (/Hot Sellers|Minimum|New Arrivals|Value Deals/i.test(txt)) {
    await s.screenshot({ path: `shot-desktop-${idx}.png` }).catch(() => {});
    console.log(`saved shot-desktop-${idx}.png :: ${txt}`);
  }
  idx++;
}

// Mobile screenshots
const mob = await launch({ mobile: true });
await go(mob.page, "#/");
await mob.page.waitForTimeout(3500);
const msections = await mob.page.locator("section").all();
let midx = 0;
for (const s of msections) {
  const txt = (await s.innerText().catch(() => "")).slice(0, 60).replace(/\n/g, " ");
  if (/Hot Sellers|Minimum|New Arrivals|Value Deals/i.test(txt)) {
    await s.screenshot({ path: `shot-mobile-${midx}.png` }).catch(() => {});
    console.log(`saved shot-mobile-${midx}.png :: ${txt}`);
  }
  midx++;
}

await browser.close();
await mob.browser.close();
