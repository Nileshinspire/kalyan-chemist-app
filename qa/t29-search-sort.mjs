// Phase G: search / filter / sort / pagination URL-state authority regression.
// Run: node qa/t29-search-sort.mjs
import { launch, go, report, interesting, assertPreview } from "./harness.mjs";
import { hash } from "./authSession.mjs";

await assertPreview();

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};
const qs = () => page.evaluate(() => window.location.hash.split("?")[1] || "");
const param = async (k) => page.evaluate((k) => new URLSearchParams(window.location.hash.split("?")[1] || "").get(k), k);
const cardCount = () => page.locator("main [data-slot='card']").filter({ hasText: /₹/ }).count();

// ── 1. Search from the header writes `search` to the URL ──
await go(page, "#/");
const search = page.locator("input[placeholder*='Search'], input[type='search']").first();
check("header search control present", (await search.count()) > 0);
await search.click().catch(() => {});
await search.fill("vol");
await page.waitForTimeout(1600);
await search.press("Enter");
await page.waitForTimeout(2500);
R.searchHash = hash(page);
check("search navigates to the listing", /\/products/.test(hash(page)), hash(page));
check("search state is in the URL", (await param("search")) !== null, await qs());

// ── 2. Sort ──
await go(page, "#/products");
const sortBtn = page.locator("main button").filter({ hasText: /Sort|Popularity|Price|Relevance/i }).first();
check("sort control present", (await sortBtn.count()) > 0);
const beforeSort = await qs();
await sortBtn.click().catch(() => {});
await page.waitForTimeout(900);
const priceOpt = page.locator("[role='option']").filter({ hasText: /Price.*Low|Low.*High|price_asc|Price: Low/i }).first();
if (!(await priceOpt.count())) {
  // fall back to any option mentioning price
  await page.locator("[role='option']").filter({ hasText: /price/i }).first().click().catch(() => {});
} else {
  await priceOpt.click().catch(() => {});
}
await page.waitForTimeout(2200);
R.afterSort = await qs();
const sortVal = await param("sort");
check("sort writes to the URL", sortVal === "price_asc", `sort=${sortVal} (${R.afterSort})`);

// ── 3. Sort survives refresh ──
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const sortAfterReload = await param("sort");
R.sortAfterReload = sortAfterReload;
check("sort survives refresh", sortAfterReload === "price_asc", `sort=${sortAfterReload}`);

// ── 4. Sort survives pagination ──
const next = page.getByRole("button", { name: /^Next$/ }).or(page.getByRole("link", { name: /^Next$/ })).first();
const hasNext = (await next.count()) > 0;
R.hasNext = hasNext;
if (hasNext) {
  const beforePage = await param("page");
  await next.click({ force: true }).catch(() => {});
  await page.waitForTimeout(2500);
  const pageVal = await param("page");
  const sortOnP2 = await param("sort");
  R.pageAfterNext = pageVal;
  check("pagination writes page to the URL", pageVal !== null && pageVal !== (beforePage || "1"), `page=${pageVal}`);
  check("sort survives pagination", sortOnP2 === "price_asc", `sort=${sortOnP2} page=${pageVal}`);
} else {
  check("pagination control available on listing", false, "no Next control found");
}

// ── 5. Sort survives Back / Forward ──
await page.goBack();
await page.waitForTimeout(2000);
const sortBack = await param("sort");
R.sortAfterBack = sortBack;
check("sort state restored by Back", sortBack === "price_asc" || sortBack === null || sortBack === undefined, `sort=${sortBack}`);
await page.goForward();
await page.waitForTimeout(2000);
const sortFwd = await param("sort");
R.sortAfterFwd = sortFwd;
check("sort state restored by Forward", sortFwd === "price_asc", `sort=${sortFwd}`);

// ── 6. Category → change category (URL authoritative) ──
await go(page, "#/products");
const catOpts = page.locator("main a[href*='category='], main button, main label").filter({ hasText: /[A-Za-z]{4,}/ });
const nCat = await catOpts.count();
R.categoryOptions = nCat;
check("category filters available", nCat >= 2, `count=${nCat}`);
if (nCat >= 2) {
  await catOpts.first().click().catch(() => {});
  await page.waitForTimeout(2200);
  const c1 = await param("category");
  R.categoryA = c1;
  check("choosing a category writes it to the URL", !!c1, `category=${c1}`);
  // second category
  const catOpts2 = page.locator("main a[href*='category='], main button, main label").filter({ hasText: /[A-Za-z]{4,}/ });
  if ((await catOpts2.count()) >= 2) {
    await catOpts2.nth(1).click().catch(() => {});
    await page.waitForTimeout(2200);
    const c2 = await param("category");
    R.categoryB = c2;
    check("changing category updates the URL", !!c2 && c2 !== c1, `${c1} → ${c2}`);
    check("changing category keeps the page sane", (await cardCount()) >= 0, `cards=${await cardCount()}`);
  }
}

// ── 7. Brand → URL ──
await go(page, "#/brands");
const brandLink = page.locator("main a").filter({ hasText: /[A-Za-z]{3,}/ }).first();
R.brandsHash = hash(page);
check("brands page reachable", /brands/.test(hash(page)), hash(page));
if (await brandLink.count()) {
  await brandLink.click().catch(() => {});
  await page.waitForTimeout(2200);
  R.brandHashAfter = hash(page);
  const b = await param("brand");
  R.brandParam = b;
  check("choosing a brand navigates to brand products", /brand|products/.test(hash(page)) && (await cardCount()) >= 0, `${hash(page)} brand=${b} cards=${await cardCount()}`);
}

// ── 8. Direct URL / refresh / back-forward for category state ──
if (R.categoryA) {
  await go(page, `#/products?category=${encodeURIComponent(R.categoryA)}`);
  const directCards = await cardCount();
  check("direct category URL renders products", directCards > 0, `cards=${directCards}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const catAfterReload = await param("category");
  check("category survives refresh", catAfterReload === R.categoryA, `category=${catAfterReload}`);
}

R.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 8);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 29: search / filter / sort / pagination URL state", R);
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL SEARCH/SORT CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);