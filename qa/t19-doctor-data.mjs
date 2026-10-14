import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const results = {};

await go(page, "#/doctor-appointment");
await page.waitForSelector("button", { timeout: 8000 }).catch(() => {});

const specialties = ["General Physician", "Dermatology", "Orthopaedics", "Paediatrics"];
results.counts = {};
for (const spec of specialties) {
  await go(page, "#/doctor-appointment");
  await page.waitForSelector("button", { timeout: 8000 }).catch(() => {});
  const chip = page.locator("button", { hasText: new RegExp(`^${spec}$`) }).first();
  if (!(await chip.count())) { results.counts[spec] = "chip missing"; continue; }
  await chip.click().catch(() => {});
  await page.waitForTimeout(1500);
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const m = body.match(/(\d+) doctor\(s\) available/);
  results.counts[spec] = m ? Number(m[1]) : (body.includes("No doctors") ? "no-match-text" : "unknown");
  // try to open a doctor detail if any exist
  if (m && Number(m[1]) > 0) {
    const card = page.locator('[class*="cursor-pointer"]').first();
    if (await card.count()) {
      await card.click().catch(() => {});
      await page.waitForTimeout(1500);
      results[`${spec}_detailUrl`] = page.url();
      results[`${spec}_detailBody`] = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 250);
      await go(page, "#/doctor-appointment");
      await page.waitForSelector("button", { timeout: 8000 }).catch(() => {});
    }
  }
}

report("Test 19: doctor data availability per specialty", { ...results, consoleErrors: interesting(consoleErrors).slice(0, 8), pageErrors, badResponses: badResponses.slice(0, 5) });
await browser.close();
