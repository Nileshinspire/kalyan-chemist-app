import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const results = {};

// 1) sort now written to URL and survives reload
await go(page, "#/products?nav=all");
const trigger = page.locator("[data-slot='select-trigger']").first();
await trigger.click().catch((e) => console.log("t:", e.message));
await page.waitForTimeout(500);
const opt = page.locator("[role='option']").filter({ hasText: /price/i }).first();
await opt.click().catch((e) => console.log("o:", e.message));
await page.waitForTimeout(2500);
const afterSelect = { url: page.url(), label: (await trigger.innerText()).trim() };
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2800);
const afterReload = {
  label: await page.locator("[data-slot='select-trigger']").first().innerText().catch(() => "(none)"),
  prices: await page.locator("[data-slot='card']").evaluateAll((els) => els.slice(0, 5).map((e) => ((e.innerText.match(/₹\s?[\d,]+/) || [""])[0]))),
};
results.sort = { afterSelect, afterReload };

// 2) pagination still works with sort in URL
const next = page.locator("[data-slot='pagination-next'], button[aria-label*='Next' i], a[aria-label*='Next' i]").first();
if (await next.count()) {
  await next.click({ force: true }).catch((e) => console.log("n:", e.message));
  await page.waitForTimeout(2500);
}
results.page2 = { url: page.url(), cards: await page.locator("[data-slot='card']").filter({ hasText: /₹/ }).count() };

await browser.close();

// 3) mobile detail overflow (plain 390 viewport)
const b2 = await launch();
const p2 = b2.page;
await p2.setViewportSize({ width: 390, height: 844 });
for (const r of ["/products/volini-gel", "/products/telma-40", "/", "/products"]) {
  await go(p2, `#${r}`);
  await p2.waitForTimeout(600);
  const d = await p2.evaluate(() => ({ vp: window.innerWidth, doc: document.documentElement.scrollWidth }));
  const wide = await p2.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2 && el.getBoundingClientRect().width > 40 && el.getBoundingClientRect().height > 10)
      .slice(0, 4)
      .map((el) => `${el.tagName}.${(el.className || "").toString().slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)}`)
  );
  results[r] = { ...d, overflow: d.doc > d.vp + 1, wide };
}
await p2.screenshot({ path: "/tmp/qa-14-detail-mobile.png" });
report("Test 14: post-fix sort URL + mobile overflow", { ...results, consoleErrors: interesting(consoleErrors), pageErrors, badResponses: badResponses.slice(0, 4) });
await b2.browser.close();
