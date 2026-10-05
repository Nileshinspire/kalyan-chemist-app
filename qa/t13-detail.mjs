import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const results = {}; // probe-edit

// 1) sort persistence across reload
await go(page, "#/products?nav=all");
const trigger = page.locator("[data-slot='select-trigger']").first();
await trigger.click().catch((e) => console.log("t:", e.message));
await page.waitForTimeout(500);
const opt = page.locator("[role='option']").filter({ hasText: /price/i }).first();
await opt.click().catch((e) => console.log("o:", e.message));
await page.waitForTimeout(2000);
const beforeReload = { url: page.url(), label: (await trigger.innerText()).trim() };
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const afterReload = {
  label: await page.locator("[data-slot='select-trigger']").first().innerText().catch(() => "(none)"),
  prices: await page.locator("[data-slot='card']").evaluateAll((els) => els.slice(0, 5).map((e) => ((e.innerText.match(/₹\s?[\d,]+/) || [""])[0]))),
};
results.sortPersistence = { beforeReload, afterReload };

// 2) auth page structure
await go(page, "#/auth?returnTo=%2Fproducts%2Ftelma-40");
results.authFields = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll("input")).map((e) => ({
    type: e.type, ph: e.placeholder, name: e.name, mode: e.inputMode, val: e.value, vis: !!e.offsetParent,
  }));
  const buttons = Array.from(document.querySelectorAll("button")).map((e) => (e.innerText || "").trim()).filter(Boolean).slice(0, 12);
  const headings = Array.from(document.querySelectorAll("h1,h2")).map((e) => (e.innerText || "").trim()).slice(0, 4);
  return { inputs, buttons, headings };
});
await page.screenshot({ path: "/tmp/qa-13-auth.png" });

// 3) product detail spec table overflow on a plain 390px viewport (no mobile emulation)
const b2 = await chromium390();
const p2 = b2.page;
await go(p2, "#/products/volini-gel");
results.table = await p2.evaluate(() => {
  const t = document.querySelector("table");
  if (!t) return null;
  const chain = [];
  let el = t.parentElement;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    chain.push({ tag: el.tagName, cls: (el.className || "").toString().slice(0, 60), ox: cs.overflowX, w: Math.round(el.getBoundingClientRect().width) });
    el = el.parentElement;
  }
  return {
    tableW: Math.round(t.getBoundingClientRect().width),
    doc: document.documentElement.scrollWidth,
    vp: window.innerWidth,
    chain: chain.slice(0, 6),
  };
});
results.detailDims = await p2.evaluate(() => ({ vp: window.innerWidth, doc: document.documentElement.scrollWidth }));
await p2.screenshot({ path: "/tmp/qa-13-table.png", fullPage: false });
await b2.browser.close();

report("Test 13: sort persistence, auth fields, spec table", { ...results, consoleErrors: interesting(consoleErrors), pageErrors, badResponses: badResponses.slice(0, 5) });
await browser.close();

async function chromium390() {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  return { browser, page };
}
