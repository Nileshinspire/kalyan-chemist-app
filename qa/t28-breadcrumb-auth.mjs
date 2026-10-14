// Phase E (breadcrumb regression) + Phase F (auth returnTo regression).
// Run: node qa/t28-breadcrumb-auth.mjs
import { launch, go, report, interesting, assertPreview } from "./harness.mjs";
import { anonymousSignIn, injectSession, hash } from "./authSession.mjs";

await assertPreview();

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};

const crumbs = () =>
  page.evaluate(() => {
    const nav = document.querySelector("nav[aria-label='Breadcrumb']");
    if (!nav) return null;
    return {
      text: nav.innerText.replace(/\s+/g, " ").trim(),
      items: [...nav.querySelectorAll("ol > li")].map((li) => {
        const a = li.querySelector("a");
        const span = li.querySelector("span[aria-current='page']") || li.querySelector("span");
        return {
          label: (a || span || li).innerText.trim(),
          href: a ? a.getAttribute("href") : null,
          clickable: !!a,
          isCurrent: !!li.querySelector("[aria-current='page']"),
        };
      }),
    };
  });

// ══ E. BREADCRUMBS ══
// discover a product slug through the UI instead of guessing
await go(page, "#/products");
const pCard = page.locator("main [data-slot='card'], main a[href*='/products/']").filter({ hasText: /₹/ }).first();
await pCard.click().catch(() => {});
await page.waitForTimeout(2200);
const productHash = hash(page);
const slug = productHash.split("/").pop();
R.productHash = productHash;

// 1. structure: hierarchy + current item non-clickable + parents linked
let c = await crumbs();
R.crumbOnProduct = c;
check("product breadcrumb renders", !!c, JSON.stringify(c));
if (c) {
  check("breadcrumb hierarchy starts at Home", /^Home/.test(c.text), c.text);
  check("breadcrumb has >= 2 items", c.items.length >= 2, JSON.stringify(c.items.map((i) => i.label)));
  check("current item is non-clickable (aria-current)", c.items[c.items.length - 1].isCurrent === true && c.items[c.items.length - 1].clickable === false, JSON.stringify(c.items[c.items.length - 1]));
  check("parent items are real links with hrefs", c.items.slice(0, -1).every((i) => i.clickable && i.href), JSON.stringify(c.items.slice(0, -1)));
}

// 2. direct URL
const directCrumb = await (async () => { await go(page, `#/products/${slug}`); return crumbs(); })();
R.crumbDirect = directCrumb;
check("direct URL shows the same breadcrumb", JSON.stringify(directCrumb) === JSON.stringify(c), JSON.stringify(directCrumb));

// 3. refresh
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
const refreshCrumb = await crumbs();
R.crumbRefresh = refreshCrumb;
check("refresh keeps breadcrumb correct", JSON.stringify(refreshCrumb) === JSON.stringify(c), JSON.stringify(refreshCrumb));

// 4. Back / Forward
await page.goBack();
await page.waitForTimeout(1800);
const backCrumb = await crumbs();
R.crumbBack = backCrumb;
check("Back drops the product crumb (no stale)", !backCrumb || !new RegExp(slug, "i").test(backCrumb.text), JSON.stringify(backCrumb));
await page.goForward();
await page.waitForTimeout(1800);
const fwdCrumb = await crumbs();
R.crumbFwd = fwdCrumb;
check("Forward restores the product crumb", !!fwdCrumb && new RegExp(slug, "i").test(fwdCrumb.text), JSON.stringify(fwdCrumb));

// 5. no history leakage: visit an unrelated page, breadcrumb must not keep the product
await go(page, "#/upload-prescription");
const uploadCrumb = await crumbs();
R.crumbUpload = uploadCrumb;
check("Upload Prescription breadcrumb correct", !!uploadCrumb && /^Home/.test(uploadCrumb.text), JSON.stringify(uploadCrumb));
check("Upload Prescription breadcrumb has no stale product", !uploadCrumb || !new RegExp(slug, "i").test(uploadCrumb.text), JSON.stringify(uploadCrumb));
if (uploadCrumb) {
  check("Upload Prescription current item non-clickable", uploadCrumb.items[uploadCrumb.items.length - 1].isCurrent && !uploadCrumb.items[uploadCrumb.items.length - 1].clickable, JSON.stringify(uploadCrumb.items));
}

// 6. product-to-category flow via search params
await go(page, "#/categories");
const catLink = page.locator("main a").filter({ hasText: /[A-Za-z]{3,}/ }).nth(1);
await catLink.click().catch(() => {});
await page.waitForTimeout(2200);
R.catHash = hash(page);
const catCrumb = await crumbs();
R.crumbCategory = catCrumb;
check("category listing has a breadcrumb", !!catCrumb, JSON.stringify(catCrumb));
check("category breadcrumb has no stale product", !catCrumb || !new RegExp(slug, "i").test(catCrumb.text), JSON.stringify(catCrumb));

// changing category updates the breadcrumb (search-param authority)
await go(page, "#/products");
const catFilters = page.locator("main a[href*='category='], main button, main label").filter({ hasText: /[A-Za-z]{3,}/ });
const beforeHash = hash(page);
if (await catFilters.count()) {
  await catFilters.first().click().catch(() => {});
  await page.waitForTimeout(2000);
  R.catParamHash = hash(page);
  check("selecting a category updates the URL", hash(page) !== beforeHash || /category=/.test(hash(page)), `${beforeHash} → ${hash(page)}`);
}

// 7. two different products must not share a breadcrumb
await go(page, "#/products");
const prodCards = page.locator("main [data-slot='card'], main a[href*='/products/']").filter({ hasText: /₹/ });
const nP = await prodCards.count();
if (nP >= 2) {
  await prodCards.first().click().catch(() => {});
  await page.waitForTimeout(2000);
  const aText = (await crumbs())?.text || "";
  await go(page, "#/products");
  await prodCards.nth(Math.min(1, nP - 1)).click().catch(() => {});
  await page.waitForTimeout(2000);
  const bText = (await crumbs())?.text || "";
  R.crumbProductA = aText;
  R.crumbProductB = bText;
  check("breadcrumb reflects the current product only", aText !== bText && bText.length > 0, `A=${aText} | B=${bText}`);
}

// ══ F. AUTH returnTo ══
// Fresh guest context: no session injected.
const guest = await launch();
const gp = guest.page;

// F1: protected route → returnTo must be the HASH route, not window.location.pathname
await gp.goto("https://sunny-baths-help.freebuff.dev/#/wishlist", { waitUntil: "domcontentloaded" });
await gp.waitForTimeout(2500);
const gUrl1 = gp.url();
R.guestWishlistUrl = gUrl1;
const rt1 = /returnTo=([^&]+)/.exec(gUrl1)?.[1];
R.guestReturnTo1 = rt1 ? decodeURIComponent(rt1) : null;
check("protected route bounces guest to sign-in", /\/(auth|login)/.test(gUrl1), gUrl1);
check("returnTo is the hash route (not pathname)", R.guestReturnTo1 === "/wishlist", `returnTo=${R.guestReturnTo1}`);
check("returnTo is not just \"/\" (HashRouter bug)", R.guestReturnTo1 !== "/" && !!R.guestReturnTo1, `returnTo=${R.guestReturnTo1}`);

// F2: product → sign-in → returnTo points at THAT product
await gp.goto(`https://sunny-baths-help.freebuff.dev/#/products/${slug}`, { waitUntil: "domcontentloaded" });
await gp.waitForTimeout(2200);
// trigger an auth-gated action (wishlist heart)
const heart = gp.locator("button:has(svg.lucide-heart)").first();
if (await heart.count()) {
  await heart.click().catch(() => {});
  await gp.waitForTimeout(2500);
}
const gUrl2 = gp.url();
R.guestProductUrl = gUrl2;
const rt2 = /returnTo=([^&]+)/.exec(gUrl2)?.[1];
R.guestReturnTo2 = rt2 ? decodeURIComponent(rt2) : null;
check("product auth gate keeps the product in returnTo", R.guestReturnTo2 === `/products/${slug}`, `returnTo=${R.guestReturnTo2}`);

// F3: sign in → actually land on the original destination
if (rt2) {
  const session = await anonymousSignIn();
  await injectSession(gp, session);
  await gp.waitForTimeout(2500);
  const afterUrl = gp.url();
  R.afterSignInUrl = afterUrl;
  check("after sign-in returns to the original product", afterUrl.includes(`#/products/${slug}`), afterUrl);
}

await guest.browser.close();

R.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 8);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 28: breadcrumb regression + auth returnTo regression", R);
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL BREADCRUMB/AUTH CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);