import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, failedRequests, badResponses } = await launch();

// Test 1: landing page loads via direct URL (deep link, no prior history)
await go(page, "#/");
const title = await page.title();
const h1 = await page.locator("h1").first().innerText().catch(() => "(no h1)");
const navLinks = await page.locator("header a, nav a").evaluateAll((els) =>
  els.map((e) => ({ text: (e.innerText || "").trim().slice(0, 40), href: e.getAttribute("href") }))
);
const ctas = await page.locator("a[href*='login'], a[href*='signup'], a[href*='auth'], button")
  .evaluateAll((els) => els.slice(0, 20).map((e) => (e.innerText || "").trim().slice(0, 50)));
const bodyText = await page.locator("body").innerText();
await page.screenshot({ path: "/tmp/qa-01-home.png", fullPage: false });

report("Test 1: Home / deep link", {
  url: page.url(),
  title,
  h1,
  navLinks,
  ctas,
  bodySample: bodyText.replace(/\s+/g, " ").slice(0, 400),
  consoleErrors: interesting(consoleErrors),
  pageErrors,
  failedRequests: failedRequests.slice(0, 15),
  badResponses,
});

await browser.close();
