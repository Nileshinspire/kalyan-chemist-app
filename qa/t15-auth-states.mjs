import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const results = {};

// 1) auth: invalid email must show a friendly error (no code is sent)
await go(page, "#/auth?returnTo=%2Fproducts%2Ftelma-40");
const email = page.locator("input[type='email']").first();
if (await email.count()) {
  await email.fill("not-an-email");
  await page.getByRole("button", { name: /send code/i }).first().click().catch((e) => console.log("send:", e.message));
  await page.waitForTimeout(1500);
}
results.invalidEmail = {
  url: page.url(),
  error: await page.locator("p.text-destructive, [role='alert'], .text-red-500, .text-destructive").first().innerText().catch(() => null),
  toast: await page.locator("[data-sonner-toast]").last().innerText().catch(() => null),
};

// 2) auth: phone tab switches the input and keeps returnTo
const phoneTab = page.getByRole("button", { name: /^Phone$/ }).first();
if (await phoneTab.count()) {
  await phoneTab.click().catch(() => {});
  await page.waitForTimeout(700);
}
results.phoneTab = {
  url: page.url(),
  inputs: await page.locator("input").evaluateAll((els) => els.map((e) => ({ type: e.type, ph: e.placeholder, mode: e.inputMode }))),
  returnToKept: page.url().includes("returnTo=%2Fproducts%2Ftelma-40"),
};

// 3) empty search results state
await go(page, "#/products?search=zzzznotarealmedicinexyz");
await page.waitForTimeout(1500);
results.emptySearch = {
  h1: await page.locator("h1").first().innerText().catch(() => "(none)"),
  body: (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 260),
  cards: await page.locator("[data-slot='card']").filter({ hasText: /₹/ }).count(),
};

// 4) doctor appointment journey (public route)
await go(page, "#/doctor-appointment");
results.doctors = {
  h1: await page.locator("h1").first().innerText().catch(() => "(none)"),
  cards: await page.locator("[data-slot='card'], a[href*='doctor']").count(),
};
const docLink = page.locator("a[href*='/doctor']").first();
if (await docLink.count()) {
  await docLink.click().catch((e) => console.log("doc:", e.message));
  await page.waitForTimeout(2500);
}
results.doctorDetail = { url: page.url(), h1: await page.locator("h1").first().innerText().catch(() => "(none)") };

// 5) policy page renders real content
await go(page, "#/return-policy");
results.policy = {
  h1: await page.locator("h1").first().innerText().catch(() => "(none)"),
  len: (await page.locator("main").innerText().catch(() => "")).length,
};

report("Test 15: auth validation, empty state, doctors, policy", { ...results, consoleErrors: interesting(consoleErrors), pageErrors, badResponses: badResponses.slice(0, 5) });
await browser.close();
