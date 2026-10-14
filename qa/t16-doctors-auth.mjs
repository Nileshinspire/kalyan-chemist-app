import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const results = {};

// A) auth phone tab — dump the segmented control and what changes
await go(page, "#/auth?returnTo=%2Fproducts%2Ftelma-40");
results.authButtons = await page.locator("button").evaluateAll((els) =>
  els.map((e) => ({ text: (e.innerText || "").trim(), pressed: e.getAttribute("aria-pressed"), sel: e.getAttribute("data-state"), cls: (e.className || "").toString().slice(0, 50) })).filter((b) => b.text).slice(0, 10)
);
const phoneBtn = page.locator("button").filter({ hasText: /^Phone$/ }).first();
results.phoneBtnCount = await phoneBtn.count();
if (results.phoneBtnCount) {
  await phoneBtn.click({ force: true }).catch((e) => console.log("pb:", e.message));
  await page.waitForTimeout(1200);
}
results.afterPhone = {
  inputs: await page.locator("input").evaluateAll((els) => els.map((e) => ({ type: e.type, ph: e.placeholder, mode: e.inputMode }))),
  buttons: await page.locator("button").evaluateAll((els) => els.map((e) => (e.innerText || "").trim()).filter(Boolean).slice(0, 8)),
};
await page.screenshot({ path: "/tmp/qa-16-auth-phone.png" });

// B) doctors page content
await go(page, "#/doctor-appointment");
results.doctorPage = {
  headings: await page.locator("h1, h2, h3").evaluateAll((els) => els.map((e) => (e.innerText || "").trim()).slice(0, 12)),
  links: await page.locator("a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href")).filter((h) => h && !h.startsWith("http") && !h.startsWith("tel") && !h.startsWith("mailto")).slice(0, 30)),
  text: (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400),
  clickable: await page.locator("main button").evaluateAll((els) => els.map((e) => (e.innerText || "").trim()).filter(Boolean).slice(0, 12)),
};
await page.screenshot({ path: "/tmp/qa-16-doctors.png" });

// C) empty search state panel
await go(page, "#/products?search=zzzznotarealmedicinexyz");
const mainText = (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ");
results.emptyPanel = mainText.slice(mainText.indexOf("found"), mainText.indexOf("found") + 300);
results.emptyButtons = await page.locator("main button").evaluateAll((els) => els.map((e) => (e.innerText || "").trim()).filter(Boolean).slice(0, 12));

report("Test 16: auth phone tab, doctors, empty state", { ...results, consoleErrors: interesting(consoleErrors), pageErrors, badResponses: badResponses.slice(0, 5) });
await browser.close();
