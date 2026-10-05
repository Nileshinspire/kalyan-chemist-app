import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const results = {};

// A) auth page — phone tab with proper waits
await go(page, "#/auth?returnTo=%2Fcart");
await page.waitForSelector('input', { timeout: 8000 }).catch(() => {});
results.authButtonsAll = await page.locator("button").evaluateAll((els) =>
  els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 15)
);
const phoneTab = page.locator("button", { hasText: /phone/i }).first();
results.phoneTabCount = await phoneTab.count();
if (results.phoneTabCount) {
  await phoneTab.click().catch((e) => console.log("phone click:", e.message));
  await page.waitForTimeout(1000);
}
results.afterPhone = {
  url: page.url(),
  inputs: await page.locator("input").evaluateAll((els) =>
    els.map((e) => ({ type: e.type, ph: e.placeholder, mode: e.inputMode }))
  ),
  buttons: await page.locator("button").evaluateAll((els) =>
    els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 10)
  ),
};
// switch back to email tab
const emailTab = page.locator("button", { hasText: /email/i }).first();
if (await emailTab.count()) {
  await emailTab.click().catch(() => {});
  await page.waitForTimeout(800);
}
results.afterEmailBack = await page.locator("input").evaluateAll((els) =>
  els.map((e) => ({ type: e.type, ph: e.placeholder, mode: e.inputMode }))
);
await page.screenshot({ path: "/tmp/qa-17-auth.png" });

// B) doctors page — real interactions
await go(page, "#/doctor-appointment");
await page.waitForSelector("h2", { timeout: 8000 }).catch(() => {});
results.doctorBody = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500);
results.doctorButtons = await page.locator("button").evaluateAll((els) =>
  els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 20)
);
// click a specialty chip
const chip = page.locator("button", { hasText: /Heart & Cardio/i }).first();
results.chipCount = await chip.count();
if (results.chipCount) {
  await chip.click().catch((e) => console.log("chip:", e.message));
  await page.waitForTimeout(1500);
}
results.afterChip = { url: page.url() };
// click first doctor card if present
const card = page.locator('[class*="cursor-pointer"]').filter({ hasText: /MD|MBBS|Dr\./i }).first();
results.cardCount = await card.count();
if (results.cardCount) {
  await card.click().catch((e) => console.log("card:", e.message));
  await page.waitForTimeout(1500);
}
results.afterCard = { url: page.url() };
results.cardPageBody = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300);
await page.screenshot({ path: "/tmp/qa-17-doctor-detail.png" });

report("Test 17: phone tab + doctors interactions", { ...results, consoleErrors: interesting(consoleErrors).slice(0, 10), pageErrors, badResponses: badResponses.slice(0, 5) });
await browser.close();
