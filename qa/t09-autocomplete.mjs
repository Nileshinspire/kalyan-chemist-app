import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

async function probeSearch(route, label) {
  await go(page, route);
  const inputs = await page.locator("input").evaluateAll((els) =>
    els.map((e, i) => ({ i, type: e.type, ph: e.placeholder, vis: !!(e.offsetParent) }))
  );
  const input = page.locator("input[placeholder*='earch' i]").first();
  const n = await input.count();
  if (!n) return { label, inputs, found: false };
  await input.click();
  await input.type("telma", { delay: 80 });
  await page.waitForTimeout(2500);
  const dom = await page.evaluate(() => {
    const listboxes = Array.from(document.querySelectorAll("[role='listbox'], [role='menu'], [data-radix-popper-content-wrapper]")).map((e) => ({
      role: e.getAttribute("role") || e.getAttribute("data-radix-popper-content-wrapper") || "",
      text: (e.innerText || "").replace(/\s+/g, " ").slice(0, 200),
      h: Math.round(e.getBoundingClientRect().height),
      hidden: e.getBoundingClientRect().height === 0,
    }));
    const opts = Array.from(document.querySelectorAll("[role='option']")).map((e) => (e.innerText || "").replace(/\s+/g, " ").slice(0, 60));
    const expanded = Array.from(document.querySelectorAll("[aria-expanded='true']")).map((e) => (e.getAttribute("aria-controls") || "") + "|" + (e.tagName));
    return { listboxes, opts, expanded, url: location.hash };
  });
  await page.screenshot({ path: `/tmp/qa-09-search-${label}.png` });
  return { label, inputs, found: true, ...dom };
}

const home = await probeSearch("#/", "home");
const listing = await probeSearch("#/products", "products");

// in-page cart sign-in button
await go(page, "#/cart");
const inMain = page.locator("main").getByRole("button", { name: /^Sign In$/ });
const imCount = await inMain.count();
let inMainUrl = null;
if (imCount) {
  await inMain.first().click().catch((e) => console.log("inmain:", e.message));
  await page.waitForTimeout(1500);
  inMainUrl = page.url();
}

// in-page wishlist sign-in button
await go(page, "#/wishlist");
const wMain = page.locator("main").getByRole("button", { name: /^Sign In$/ });
const wmCount = await wMain.count();
let wMainUrl = null;
if (wmCount) {
  await wMain.first().click().catch(() => {});
  await page.waitForTimeout(1500);
  wMainUrl = page.url();
}

report("Test 9: autocomplete + in-page sign-in", { home, listing, imCount, inMainUrl, wmCount, wMainUrl, consoleErrors: interesting(consoleErrors), pageErrors, badResponses });

await browser.close();
