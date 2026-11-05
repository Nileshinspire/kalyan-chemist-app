import { chromium } from "playwright-core";
const BASE = "https://sunny-baths-help.freebuff.dev/preview-templates.html";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  for (const key of ["health", "diwali", "holi", "christmas", "offer", "announcement"]) {
    await page.locator(`[data-fixture="${key}"] > div`).screenshot({ path: `/tmp/shots/${label}-${key}.png` });
  }
  await page.close();
}
await browser.close();
console.log("shots done");
