import { chromium } from "playwright-core";

const BASE = "https://sunny-baths-help.freebuff.dev";
const CONVEX = "https://dutiful-fox-804.convex.cloud";
const A = "nileshvishwakarma.work@gmail.com";
const B = "NILESHVISHWAKARMA.WORK@GMAIL.COM";
const A_ID = "jx79mspzpfbb16m85yjdnycryn8cpvda";
const CODE = "318254";
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok: Boolean(ok) });
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
  if (json?.status !== "success") throw new Error("seed failed");
}

async function dismissPopup(page) {
  if ((await page.locator('[role="dialog"]').count()) > 0) {
    await page.keyboard.press("Escape");
    await sleep(400);
  }
}

async function login(page, email) {
  await dismissPopup(page);
  await page.waitForSelector("#login-email", { timeout: 15000 });
  await page.fill("#login-email", email);
  await page.click('button[type="submit"]');
  await sleep(3500);
  const body = await page.locator("body").innerText();
  if (/Too many/i.test(body)) throw new Error("gateway rate limited");
  await seed(email);
  for (let i = 0; i < 6; i++) {
    await page.fill(`[data-otp-input="${i}"]`, CODE[i]);
    await sleep(90);
  }
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (!/#\/auth/.test(page.url())) break;
  }
  await sleep(1200);
  return hash(page);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto(`${BASE}/#/auth`, { waitUntil: "domcontentloaded" });
  await sleep(1800);
  const aLanding = await login(page, A);
  check("A signs in and reaches the default page", aLanding === "/dashboard", aLanding);

  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(5000);
  await dismissPopup(page);
  const aList = await page.locator("body").innerText();
  check("A sees A-only order notifications", /Refund Initiated|Order Cancelled|WhatsApp Order Confirmed/.test(aList));
  const tokenBefore = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("__convexAuth")).length,
  );

  await page.locator("button", { hasText: /^Logout$/ }).first().click();
  await sleep(5500);
  check("logout from Notifications lands on home", hash(page) === "/", page.url());
  check("logout URL carries no returnTo/notification", !/returnTo|notification=/.test(page.url()), page.url());
  const st = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  check("logout erased every auth token", !Object.keys(st).some((k) => k.startsWith("__convexAuth")) && !st.kc_token, `had ${tokenBefore}`);
  check("logout recorded the account switch", st["kc_auth_switch_pending"] === "1");
  check("logout remembered which account left", st["kc_auth_last_user_id"] === A_ID, st["kc_auth_last_user_id"] ?? "null");

  // Signed-out direct visit to the old private page must not create a returnTo.
  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(3000);
  check("signed-out protected visit sends no previous page as returnTo", !/returnTo=%2Faccount/.test(page.url()), page.url());

  await page.goto(`${BASE}/#/`, { waitUntil: "domcontentloaded" });
  await sleep(1600);
  await dismissPopup(page);
  const signIn = page.getByRole("button", { name: /^Sign In$/ }).first();
  if (await signIn.count()) {
    await signIn.click();
    await sleep(1500);
  } else {
    await page.goto(`${BASE}/#/auth`, { waitUntil: "domcontentloaded" });
    await sleep(1200);
  }
  const bLanding = await login(page, B);
  check("B lands on the homepage, not the previous Notifications page", bLanding === "/", bLanding);
  check("switch marker consumed", (await page.evaluate(() => localStorage.getItem("kc_auth_switch_pending"))) === null);

  await page.goto(`${BASE}/#/account`, { waitUntil: "domcontentloaded" });
  await sleep(6000);
  const overview = await page.locator("body").innerText();
  const welcome = overview.split("\n").find((l) => /Welcome back/i.test(l)) ?? "";
  const identity = overview.split("\n").find((l) => /@gmail/i.test(l)) ?? "";
  check("B account shows B's name", /lisa/i.test(welcome), welcome);
  check("B account shows B's email, never A's", identity.trim() === B, identity);
  check("account page did not crash", !/Something went wrong/i.test(overview));

  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(5000);
  await dismissPopup(page);
  const bList = await page.locator("body").innerText();
  check("B notifications contain no A-only messages", !/Refund Initiated|Order Cancelled|WhatsApp Order Confirmed/.test(bList));
  // Real campaign notifications must pick their real festival template.
  await page.locator('button', { hasText: "happy holi" }).first().click();
  await sleep(2000);
  const holiHero = await page.locator("[data-notification-hero]").first().getAttribute("data-notification-hero");
  const holiDialog = await page.locator('[role="dialog"]').innerText();
  check("real 'happy holi' notification uses the Holi template", holiHero === "holi", String(holiHero));
  check("real Holi notification keeps its full message", /enjoy color full holi/i.test(holiDialog));
  check("detail shows category + date chips", /Festival Wishes/i.test(holiDialog) && /\d{1,2} \w{3} \d{4}/.test(holiDialog));
  await page.keyboard.press("Escape");
  await sleep(800);
  await page.locator('button', { hasText: "happy gandhi jaynti" }).first().click();
  await sleep(2000);
  const gandhiHero = await page.locator("[data-notification-hero]").first().getAttribute("data-notification-hero");
  check("real 'happy gandhi jaynti' uses its own Gandhi Jayanti template", gandhiHero === "gandhi", String(gandhiHero));
  await page.keyboard.press("Escape");
  await sleep(800);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(4500);
  const refreshed = await page.locator("body").innerText();
  check("refresh keeps B and B's notifications", !/Refund Initiated|Order Cancelled/.test(refreshed) && /Notification/i.test(refreshed));

  await page.goto(`${BASE}/#/account/profile`, { waitUntil: "domcontentloaded" });
  await sleep(4000);
  await page.locator("button", { hasText: /^Logout$/ }).first().click();
  await sleep(5000);
  check("logout from Profile also lands on home", hash(page) === "/", page.url());
} catch (e) {
  check("test completed without crashing", false, e.message);
} finally {
  await browser.close();
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
}
