import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

await go(page, "#/products");
const input = page.locator("input[placeholder='Search medicines...']").first();
await input.click();
await input.type("telma", { delay: 90 });
await page.waitForTimeout(3000);
const auto = await page.evaluate(() => {
  const box = document.querySelector("[class*='absolute'][class*='z-']");
  const items = Array.from(document.querySelectorAll("button, li, div")).filter((e) => {
    const r = e.getBoundingClientRect();
    return r.height > 10 && r.height < 80 && /telma/i.test(e.innerText || "") && e.children.length <= 3;
  }).map((e) => ({ text: (e.innerText || "").replace(/\s+/g, " ").slice(0, 60), tag: e.tagName }));
  return { items: items.slice(0, 8), bodyHasTelma: /Telma/i.test(document.body.innerText) };
});
await page.screenshot({ path: "/tmp/qa-10-autocomplete.png" });

// click a suggestion if present
const suggestion = page.locator("button, li, div").filter({ hasText: /^Telma 40/ }).last();
const sugCount = await suggestion.count();
if (sugCount) {
  await suggestion.click().catch((e) => console.log("sug:", e.message));
  await page.waitForTimeout(2500);
}
const afterSuggestUrl = page.url();
const afterSuggestH1 = await page.locator("h1").first().innerText().catch(() => "(none)");

// sort + pagination on listing
await go(page, "#/products?nav=all");
const sortEls = await page.locator("button, [role='combobox']").evaluateAll((els) =>
  els.map((e) => (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ")).filter((t) => /sort|price|popul|newest|discoun|rating/i.test(t)).slice(0, 10)
);
const urlBefore = page.url();
const sortBtn = page.locator("button, [role='combobox']").filter({ hasText: /sort|popularity|price/i }).first();
const sbCount = await sortBtn.count();
if (sbCount) {
  await sortBtn.click().catch((e) => console.log("sort:", e.message));
  await page.waitForTimeout(700);
  const opt = page.locator("[role='option'], [role='menuitem']").filter({ hasText: /price|low to high/i }).first();
  if (await opt.count()) await opt.click().catch(() => {});
  await page.waitForTimeout(2000);
}
const urlAfterSort = page.url();

const next = page.getByRole("button", { name: /^Next$/ }).first();
const nextCount = await next.count();
if (nextCount) {
  await next.click({ force: true }).catch((e) => console.log("next:", e.message));
  await page.waitForTimeout(2500);
}
const urlAfterNext = page.url();
const cards = await page.locator("[data-slot='card']").filter({ hasText: /₹/ }).count();

// browser back returns to page 1
await page.goBack();
await page.waitForTimeout(2500);
const urlAfterBack = page.url();
const cardsBack = await page.locator("[data-slot='card']").filter({ hasText: /₹/ }).count();

report("Test 10: autocomplete + sort + pagination", {
  auto, sugCount, afterSuggestUrl, afterSuggestH1,
  sortEls, sbCount, urlBefore, urlAfterSort,
  nextCount, urlAfterNext, cards,
  urlAfterBack, cardsBack,
  consoleErrors: interesting(consoleErrors), pageErrors, badResponses,
});

await browser.close();
