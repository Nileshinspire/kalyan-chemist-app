import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const results = {};

// specialty chip -> filtered doctors view
await go(page, "#/doctor-appointment");
await page.waitForSelector("button", { timeout: 8000 }).catch(() => {});
const chip = page.locator("button", { hasText: "Cardiology" }).first();
results.chipCount = await chip.count();
if (results.chipCount) {
  await chip.click().catch((e) => console.log("chip:", e.message));
  await page.waitForTimeout(1800);
}
results.afterChip = { url: page.url() };
results.chipViewBody = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 450);

// doctor cards in filtered view
const cards = page.locator('[class*="cursor-pointer"]');
results.cardCount = await cards.count();
const firstCard = cards.first();
if (results.cardCount) {
  results.firstCardText = ((await firstCard.innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 120);
  await firstCard.click().catch((e) => console.log("card:", e.message));
  await page.waitForTimeout(1800);
}
results.afterCard = { url: page.url() };
results.cardPageBody = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 350);
await page.screenshot({ path: "/tmp/qa-18-doctor-detail.png" });

// back to specialty listing, verify "Find a Doctor in 3 easy steps" flow: combobox select
await go(page, "#/doctor-appointment");
results.stepForm = await page.locator("input, [role=combobox], select").evaluateAll((els) =>
  els.map((e) => ({ tag: e.tagName, type: e.type || "", ph: e.placeholder || "", role: e.getAttribute("role") || "" })).slice(0, 8)
);

report("Test 18: doctor specialty + card navigation", { ...results, consoleErrors: interesting(consoleErrors).slice(0, 10), pageErrors, badResponses: badResponses.slice(0, 5) });
await browser.close();
