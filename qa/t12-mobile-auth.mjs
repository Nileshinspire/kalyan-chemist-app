import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const results = {};

// A) the returnTo target used by the home card must be a real product page
await go(page, "#/products/nebulizers");
results.nebulizers = {
  h1: await page.locator("h1").first().innerText().catch(() => "(none)"),
  notFound: /page not found/i.test(await page.locator("body").innerText()),
};

// B) sort control (desktop select trigger)
await go(page, "#/products?nav=all");
const trigger = page.locator("[data-slot='select-trigger']").first();
results.sortTriggerCount = await trigger.count();
if (results.sortTriggerCount) {
  results.sortLabelBefore = (await trigger.innerText()).trim();
  await trigger.click().catch((e) => console.log("trigger:", e.message));
  await page.waitForTimeout(600);
  const opt = page.locator("[role='option']").filter({ hasText: /price/i }).first();
  results.optionCount = await opt.count();
  if (results.optionCount) {
    await opt.click().catch((e) => console.log("opt:", e.message));
    await page.waitForTimeout(2500);
  }
  results.sortUrlAfter = page.url();
  results.prices = await page.locator("[data-slot='card']").evaluateAll((els) =>
    els.slice(0, 6).map((e) => ((e.innerText.match(/₹\s?[\d,]+/) || [""])[0]))
  );
}

// C) pagination
const next = page.locator("[data-slot='pagination-next'], button[aria-label*='Next' i], a[aria-label*='Next' i]").first();
results.nextCount = await next.count();
results.nextDisabled = results.nextCount ? await next.isDisabled().catch(() => null) : null;
if (results.nextCount && !results.nextDisabled) {
  await next.click({ force: true }).catch((e) => console.log("next:", e.message));
  await page.waitForTimeout(2500);
}
results.pageUrlAfterNext = page.url();

// D) auth page validation (no codes are sent)
await go(page, "#/auth?returnTo=%2Fproducts%2Ftelma-40");
const phoneInput = page.locator("input[type='tel'], input[name*='phone' i], input[placeholder*='mobile' i], input[placeholder*='phone' i]").first();
results.phoneInputCount = await phoneInput.count();
if (results.phoneInputCount) {
  await phoneInput.fill("12345");
  const sendBtn = page.getByRole("button", { name: /send|get code|continue|next/i }).first();
  if (await sendBtn.count()) {
    await sendBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
  }
}
results.authValidation = {
  url: page.url(),
  error: await page.locator("[role='alert'], p[class*='destructive'], .text-destructive").first().innerText().catch(() => null),
  toast: await page.locator("[data-sonner-toast]").last().innerText().catch(() => null),
};

await browser.close();

// E) mobile overflow + menu
const m = await launch({ mobile: true });
const { page: mp, consoleErrors: mc, pageErrors: mperr, badResponses: mbad } = m;
const mobile = [];
for (const r of ["/", "/products", "/products/volini-gel", "/cart", "/auth?returnTo=%2Fproducts%2Fvolini-gel"]) {
  await go(mp, `#${r}`);
  await mp.waitForTimeout(800);
  const dims = await mp.evaluate(() => ({ vp: window.innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  const offenders = await mp.evaluate(() => {
    const vp = window.innerWidth;
    return Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > vp + 2 && r.width > 40 && r.height > 10 && getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 5)
      .map((el) => `${el.tagName}.${(el.className || "").toString().slice(0, 50)} right=${Math.round(el.getBoundingClientRect().right)}`);
  });
  mobile.push({ route: r, ...dims, overflow: dims.doc > dims.vp + 1, offenders });
  await mp.screenshot({ path: `/tmp/qa-12-mobile-${r.replace(/[^a-z0-9]/gi, "_")}.png` });
}
// hamburger menu
await go(mp, "#/");
const burger = mp.locator("button[aria-label*='menu' i], button[aria-label*='Menu' i]").first();
const burgerCount = await burger.count();
if (burgerCount) {
  await burger.click().catch((e) => console.log("burger:", e.message));
  await mp.waitForTimeout(900);
}
const menuText = await mp.locator("body").innerText();
results.mobile = { mobile, burgerCount, menuOpens: /Upload Prescription|Lab Tests|Sign In/i.test(menuText) };
results.mobileErrors = { console: interesting(mc), pageErrors: mperr, bad: mbad.slice(0, 5) };

report("Test 12: sort, pagination, auth validation, mobile", results);
await m.browser.close();
