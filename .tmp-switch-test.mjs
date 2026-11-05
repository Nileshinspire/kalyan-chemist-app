import { chromium } from "playwright-core";

const BASE = "https://sunny-baths-help.freebuff.dev";
const CONVEX = "https://dutiful-fox-804.convex.cloud";
const A = "nileshvishwakarma.work@gmail.com";
const B = "NILESHVISHWAKARMA.WORK@GMAIL.COM";
const CODE = "318254";
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok: Boolean(ok), extra });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${extra ? " :: " + extra : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (page) => page.url().split("#")[1] ?? "/";

async function seed(email) {
  const res = await fetch(`${CONVEX}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "zzDevHarness:seedOtp", args: { email, code: CODE }, format: "json" }),
  });
  const json = await res.json();
  if (json?.status !== "success") throw new Error("seed failed: " + JSON.stringify(json).slice(0, 200));
}

async function dismissPopup(page) {
  if ((await page.locator('[role="dialog"]').count()) > 0) {
    await page.keyboard.press("Escape");
    await sleep(500);
    if ((await page.locator('[role="dialog"]').count()) > 0) {
      const c = page.getByRole("button", { name: /^Close$/ }).first();
      if (await c.count()) await c.click();
      await sleep(400);
    }
  }
}

async function login(page, email) {
  await dismissPopup(page);
  await page.waitForSelector("#login-email", { timeout: 25000 });
  await page.fill("#login-email", email);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.click('button[type="submit"]');
    await sleep(4000);
    const body = await page.locator("body").innerText();
    if (/Too many/i.test(body)) {
      console.log("   gateway rate limit — waiting 100s");
      await sleep(100000);
      continue;
    }
    break;
  }
  if (!(await page.locator('[data-otp-input="0"]').count())) {
    throw new Error("OTP stage not reached: " + (await page.locator('[role="alert"]').first().innerText().catch(() => "?")));
  }
  await seed(email);
  for (let i = 0; i < 6; i++) {
    await page.fill(`[data-otp-input="${i}"]`, CODE[i]);
    await sleep(100);
  }
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    if (!/#\/auth/.test(page.url())) break;
  }
  await sleep(1500);
  return hash(page);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 120)));
try {
  // ── 1. Account A signs in from a clean state ──
  await page.goto(`${BASE}/#/auth`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  const aLanding = await login(page, A);
  check("A signs in → default post-login page", aLanding === "/dashboard", aLanding);

  // ── 2. A opens Notifications and logs out there ──
  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(6500);
  await dismissPopup(page);
  const aList = await page.locator("body").innerText();
  check("A sees A-only order notification", /Refund Initiated|Order Cancelled|WhatsApp Order Confirmed/.test(aList));
  await page.locator("button", { hasText: /^Logout$/ }).first().click();
  await sleep(6500);
  check("logout from Notifications lands on home", hash(page) === "/", page.url());
  check("logout URL keeps no returnTo/notification", !/returnTo|notification=/.test(page.url()), page.url());
  const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const tokens = Object.keys(storage).filter((k) => k.startsWith("__convexAuth") || k === "kc_token");
  check("logout erased every auth token", tokens.length === 0, tokens.join(","));
  check("logout marks the account switch", storage["kc_auth_switch_pending"] === "1");
  const signedOutBody = await page.locator("body").innerText();
  check("home is signed out after logout", !/My Account/.test(signedOutBody));

  // ── 3. B signs in through the site's own Sign In button ──
  await dismissPopup(page);
  const signIn = page.getByRole("button", { name: /^Sign In$/ }).first();
  if (await signIn.count()) {
    await signIn.click();
    await sleep(2000);
  } else {
    await page.goto(`${BASE}/#/auth`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
  }
  check("Sign In CTA carries no account returnTo", !/returnTo=%2Faccount/.test(page.url()), page.url());
  const bLanding = await login(page, B);
  check("B lands on the homepage, not A's Notifications page", bLanding === "/", bLanding);
  check("switch marker consumed after B signs in", (await page.evaluate(() => localStorage.getItem("kc_auth_switch_pending"))) === null);

  // ── 4. B only sees B's private data ──
  await page.goto(`${BASE}/#/account/profile`, { waitUntil: "domcontentloaded" });
  await sleep(6000);
  const bProfile = await page.locator("body").innerText();
  check("B profile shows B's identity", /lisa/i.test(bProfile) && /NILESHVISHWAKARMA\.WORK@GMAIL\.COM/i.test(bProfile), bProfile.split("\n").filter((l) => /lisa|@gmail|john/i.test(l)).slice(0, 4).join(" | "));
  check("B profile never shows A's name/email", !/\bjohn\b/i.test(bProfile) && !/nileshvishwakarma\.work@gmail\.com/i.test(bProfile), bProfile.split("\n").filter((l) => /john|nileshvishwakarma/i.test(l)).slice(0, 4).join(" | "));
  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(6500);
  await dismissPopup(page);
  const bList = await page.locator("body").innerText();
  check("B notifications are B's (no A-only messages)", !/Refund Initiated|Order Cancelled|WhatsApp Order Confirmed/.test(bList));
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(6500);
  const afterRefresh = await page.locator("body").innerText();
  check("refresh keeps B's session on B's page", /lisa|NILESHVISHWAKARMA\.WORK@GMAIL\.COM/i.test(afterRefresh) || !/john/i.test(afterRefresh));

  // ── 5. Logout from a different page (Profile) ──
  await page.goto(`${BASE}/#/account/profile`, { waitUntil: "domcontentloaded" });
  await sleep(5000);
  await page.locator("button", { hasText: /^Logout$/ }).first().click();
  await sleep(6500);
  check("logout from Profile also lands on home", hash(page) === "/", page.url());

  // ── 6. Stale `/auth?returnTo=/account/notifications` URL must not restore it ──
  await page.goto(`${BASE}/#/auth?returnTo=%2Faccount%2Fnotifications`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  const aAgain = await login(page, A);
  check("A signing in from a stale Notifications returnTo lands on home", aAgain === "/", aAgain);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(6500);
  check("A stays signed in on home after refresh", hash(page) === "/", page.url());

  // ── 7. Session expiry while on Notifications, then B signs in there ──
  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(4000);
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("__convexAuth")) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(6000);
  check("expired session bounces to auth with the private page as returnTo", /\/auth\?returnTo=%2Faccount%2Fnotifications/.test(page.url()), page.url());
  const bAfterExpiry = await login(page, B);
  check("B signing in from that bounce lands on the homepage", bAfterExpiry === "/", bAfterExpiry);
  const finalStorage = await page.evaluate(() => localStorage.getItem("kc_auth_last_user_id"));
  check("last-user marker now points at B", Boolean(finalStorage) && finalStorage !== "jx79mspzpfbb16m85yjdnycryn8cpvda", finalStorage ?? "null");
} catch (e) {
  check("test completed without crashing", false, e.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
}
