// Authenticated QA — session + Account Dashboard subpage navigation.
// Run: node qa/t21-account-nav.mjs
import { launch, go, report, interesting } from "./harness.mjs";
import { anonymousSignIn, injectSession, hash, pageSummary } from "./authSession.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};

const session = await anonymousSignIn();
await go(page, "#/");
await injectSession(page, session);

// ── 1. Session persists across navigation, no unexpected logout ──
for (const h of ["#/", "#/products", "#/cart"]) {
  await go(page, h);
  const hh = hash(page);
  const redirectedToAuth = /^\/auth/.test(hh);
  check(`session alive at ${h}`, !redirectedToAuth, `hash=${hh}`);
}
const cartGate = await page.locator("h1").first().innerText().catch(() => "");
check("cart renders authenticated UI (no sign-in gate)", !/Sign In to Shop/i.test(cartGate), cartGate);
await page.screenshot({ path: "/tmp/qa-21-cart-authed.png" });

// ── 2. Account Dashboard ──
await go(page, "#/account");
R.dashboard = { hash: hash(page), ...(await pageSummary(page)) };
check("account dashboard opens", hash(page) === "/account", hash(page));
const DASH_H1 = R.dashboard.h1[0] || "";

// Sidebar links present
const links = await page.locator("nav a, aside a").evaluateAll((els) =>
  [...new Set(els.map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean))]
);
R.sidebarLinks = links;

// ── 3. Dashboard → subpage → Back → Dashboard (one back, no loop) ──
const SUBS = [
  { label: "Profile", hash: "/account/profile", keyword: /profile/i },
  { label: "Addresses", hash: "/account/addresses", keyword: /address/i },
  { label: "My Orders", hash: "/account/orders", keyword: /order/i },
  { label: "Prescriptions", hash: "/account/prescriptions", keyword: /prescription/i },
  { label: "Wishlist", hash: "/account/wishlist", keyword: /wishlist/i },
  { label: "Notifications", hash: "/account/notifications", keyword: /notification/i },
];
R.subpages = [];
for (const sub of SUBS) {
  if (hash(page) !== "/account") { await go(page, "#/account"); await page.waitForTimeout(600); }
  const link = page.locator("a", { hasText: new RegExp(`^${sub.label}$`) }).first();
  const has = (await link.count()) > 0;
  check(`sidebar link "${sub.label}"`, has);
  if (!has) continue;
  await link.click().catch((e) => R.failures.push(`click ${sub.label}: ${e.message}`));
  await page.waitForTimeout(1400);
  const at = hash(page);
  const sum = await pageSummary(page);
  R.subpages.push({ ...sub, hashSeen: at, h1: sum.h1, head: sum.mainHead, buttons: sum.buttons });
  check(`${sub.label} opens at ${sub.hash}`, at === sub.hash, `got ${at}`);
  check(`${sub.label} renders own content`, sub.keyword.test(`${sum.h1.join(" ")} ${sum.mainHead}`), sum.mainHead.slice(0, 90));
  check(`${sub.label} not empty/stale`, sum.mainLen > 40, `mainLen=${sum.mainLen}`);
  await page.screenshot({ path: `/tmp/qa-21-${sub.label.replace(/\s+/g, "-").toLowerCase()}.png` });

  // Back: one browser-back must return to the dashboard (no duplicate entry / loop)
  await page.goBack().catch(() => {});
  await page.waitForTimeout(1400);
  const backHash = hash(page);
  const backSum = await pageSummary(page);
  check(`Back from ${sub.label} lands on dashboard`, backHash === "/account", `got ${backHash}`);
  check(`Back from ${sub.label} shows dashboard (not stale ${sub.label})`, backSum.h1.includes(DASH_H1) && !sub.keyword.test(backSum.h1.join(" ")), backSum.h1.join(" | "));
}

// ── 4. Direct deep-link into an account subpage (fresh load) ──
await go(page, "#/account/wishlist");
check("deep link #/account/wishlist loads authed (no /auth bounce)", hash(page) === "/account/wishlist", hash(page));
await go(page, "#/account");
check("returning to #/account from deep link works", hash(page) === "/account", hash(page));

R.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 8);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 21: authenticated session + account navigation", R);
console.log(`\n${R.failures.length ? "FAILURES:" : "ALL ACCOUNT-NAV CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);
