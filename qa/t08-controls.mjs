import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

// --- A: guest clicks wishlist heart on a listing card
await go(page, "#/products");
const card = page.locator("[data-slot='card']").filter({ hasText: /₹/ }).first();
const iconBtn = card.locator("button").first();
const iconLabel = await iconBtn.getAttribute("aria-label");
await iconBtn.click().catch((e) => console.log("heart:", e.message));
await page.waitForTimeout(2200);
const heartToast = await page.locator("[data-sonner-toast]").last().innerText().catch(() => null);
const heartUrl = page.url();

// --- B: sort / filter controls on the listing page
await go(page, "#/products");
const controls = await page.locator("main button, main [role='combobox'], main select, aside button").evaluateAll((els) =>
  els.map((e) => (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 25)
);

// --- C: header search autocomplete
await go(page, "#/");
const input = page.locator("input[placeholder*='Search'], input[type='search']").first();
await input.click().catch(() => {});
await input.type("telma", { delay: 60 });
await page.waitForTimeout(2500);
const popupHtml = await page.evaluate(() => {
  const cands = Array.from(document.querySelectorAll("div,ul")).filter((d) => {
    const t = (d.innerText || "").toLowerCase();
    return t.includes("telma") && d.children.length > 0 && d.getBoundingClientRect().height > 20 && d.getBoundingClientRect().height < 600;
  });
  const el = cands.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
  return el ? { text: el.innerText.replace(/\s+/g, " ").slice(0, 250), cls: (el.className || "").toString().slice(0, 80) } : null;
});
await page.screenshot({ path: "/tmp/qa-08-search.png" });

// --- D: guest cart sign-in button target
await go(page, "#/cart");
const cartSignIn = page.getByRole("button", { name: /^Sign In$/ }).first();
const csCount = await cartSignIn.count();
if (csCount) await cartSignIn.click().catch(() => {});
await page.waitForTimeout(1500);
const cartSignInUrl = page.url();

report("Test 8: wishlist gate, sort controls, autocomplete, cart sign-in", {
  iconLabel, heartToast, heartUrl,
  controls,
  popup: popupHtml,
  csCount, cartSignInUrl,
  consoleErrors: interesting(consoleErrors),
  pageErrors,
  badResponses,
});

await browser.close();
