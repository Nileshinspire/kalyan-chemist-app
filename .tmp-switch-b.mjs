import { chromium } from "playwright-core";

const BASE = "https://sunny-baths-help.freebuff.dev";
const CONVEX = "https://dutiful-fox-804.convex.cloud";
const A = "nileshvishwakarma.work@gmail.com";
const B = "NILESHVISHWAKARMA.WORK@GMAIL.COM";
const A_ID = "jx79mspzpfbb16m85yjdnycryn8cpvda";
const B_ID = "jx795es1jh57rmbp5gnzwcqq4x8cwdw9";
const CODE = "318254";
const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
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
  if (/Too many/i.test(await page.locator("body").innerText())) throw new Error("gateway rate limited");
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

async function identity(page) {
  await page.goto(`${BASE}/#/account`, { waitUntil: "domcontentloaded" });
  await sleep(5500);
  const text = await page.locator("body").innerText();
  return {
    welcome: text.split("\n").find((l) => /Welcome back/i.test(l)) ?? "",
    email: text.split("\n").find((l) => /@gmail/i.test(l)) ?? "",
  };
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto(`${BASE}/#/`, { waitUntil: "domcontentloaded" });
  await sleep(1500);

  // This browser was last used by B, but a stale auth URL still points at the
  // Notifications page A used to visit.
  await page.evaluate(
    ({ id }) => localStorage.setItem("kc_auth_last_user_id", id),
    { id: B_ID },
  );
  await page.goto(`${BASE}/#/auth?returnTo=%2Faccount%2Fnotifications`, { waitUntil: "domcontentloaded" });
  await sleep(1800);
  const staleLanding = await login(page, A);
  check("A from a stale Notifications returnTo lands on home", staleLanding === "/", staleLanding);
  const aWho = await identity(page);
  check("that session is really A", /john/i.test(aWho.welcome), aWho.welcome);
  check("A's own email is shown", aWho.email.trim().toLowerCase() === A.toLowerCase(), aWho.email);
  check("last-user marker now A", (await page.evaluate(() => localStorage.getItem("kc_auth_last_user_id"))) === A_ID);

  // Session expires while A sits on Notifications: the guard rewrites the URL
  // with returnTo, then B signs in there.
  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(4000);
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("__convexAuth")) localStorage.removeItem(k);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(5500);
  check("expired session bounces to auth with the private page", /\/auth\?returnTo=%2Faccount%2Fnotifications/.test(page.url()), page.url());
  const expiryLanding = await login(page, B);
  check("B signing in from that bounce lands on home", expiryLanding === "/", expiryLanding);
  const bWho = await identity(page);
  check("that session is really B", /lisa/i.test(bWho.welcome), bWho.welcome);
  check("B's own email is shown", bWho.email.trim() === B, bWho.email);

  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(5000);
  await dismissPopup(page);
  const list = await page.locator("body").innerText();
  check("B's notifications never include A-only messages", !/Refund Initiated|Order Cancelled|WhatsApp Order Confirmed/.test(list));
} catch (e) {
  check("test completed without crashing", false, e.message);
} finally {
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
}
