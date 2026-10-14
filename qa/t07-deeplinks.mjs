import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

// --- A: guest clicks card "Cart" button (listing + home)
await go(page, "#/products");
const card = page.locator("[data-slot='card']").filter({ hasText: /₹/ }).first();
await card.getByRole("button", { name: /^Cart$/ }).first().click().catch((e) => console.log("cardCart:", e.message));
await page.waitForTimeout(2200);
const cardCartUrl = page.url();
const cardCartToast = await page.locator("[data-sonner-toast]").last().innerText().catch(() => null);

await go(page, "#/");
const homeCard = page.locator("[data-slot='card']").filter({ hasText: /₹/ }).first();
const homeBtns = await homeCard.locator("button").evaluateAll((els) => els.map((e) => (e.innerText || "").trim()));
await homeCard.getByRole("button", { name: /^Cart$/ }).first().click().catch((e) => console.log("homeCart:", e.message));
await page.waitForTimeout(2200);
const homeCartUrl = page.url();
const homeCartToast = await page.locator("[data-sonner-toast]").last().innerText().catch(() => null);

// --- B: deep-link sweep (direct URL = refresh behaviour)
const routes = [
  "/products", "/products/volini-gel", "/categories", "/hot-sellers", "/value-deals",
  "/cart", "/checkout", "/orders", "/account", "/account/orders", "/account/addresses",
  "/wishlist", "/upload-prescription", "/lab-tests", "/doctor-appointment", "/refill",
  "/chatbot", "/faqs", "/about-us", "/contact-us", "/shipping-delivery", "/dashboard",
  "/does-not-exist-xyz",
];
const sweep = [];
for (const r of routes) {
  const errsBefore = consoleErrors.length;
  await page.goto(`https://sunny-baths-help.freebuff.dev/#${r}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);
  const h = await page.locator("h1, h2").first().innerText().catch(() => "(none)");
  const url = page.url();
  const newErrs = consoleErrors.length - errsBefore;
  const bodyHasNotFound = /404|page not found|doesn.t exist/i.test(await page.locator("body").innerText());
  sweep.push({ route: r, landed: url.replace("https://sunny-baths-help.freebuff.dev", ""), heading: h.replace(/\s+/g, " ").slice(0, 55), newErrs, notFound: bodyHasNotFound });
}

report("Test 7: guest card cart + deep-link sweep", {
  cardCartUrl, cardCartToast, homeBtns, homeCartUrl, homeCartToast,
  sweep,
  consoleErrors: interesting(consoleErrors),
  pageErrors,
  badResponses: badResponses.slice(0, 10),
});

await browser.close();
