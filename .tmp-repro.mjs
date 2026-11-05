import { chromium } from "playwright-core";

const BASE = "https://sunny-baths-help.freebuff.dev";
const CONVEX = "https://dutiful-fox-804.convex.cloud";
const A = "nileshvishwakarma.work@gmail.com";
const B = "NILESHVISHWAKARMA.WORK@GMAIL.COM";
const CODE = "318254";

async function seed(email) {
  const res = await fetch(`${CONVEX}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "zzDevHarness:seedOtp",
      args: { email, code: CODE },
      format: "json",
    }),
  });
  const json = await res.json();
  console.log("seed", email, JSON.stringify(json).slice(0, 160));
  if (json?.status !== "success") throw new Error("seed failed");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismissPopup(page) {
  const dialog = page.locator('[role="dialog"]');
  if ((await dialog.count()) > 0) {
    await page.keyboard.press("Escape");
    await sleep(400);
  }
}

async function login(page, email) {
  await dismissPopup(page);
  await page.waitForSelector("#login-email", { timeout: 20000 });
  await page.fill("#login-email", email);
  await page.click('button[type="submit"]');
  await sleep(5000);
  const body = await page.locator("body").innerText();
  if (/Too many/i.test(body)) {
    console.log("SEND BLOCKED —", body.match(/Too many[^\n]*/)?.[0]);
    return false;
  }
  await seed(email);
  await page.waitForSelector('[data-otp-input="0"]', { timeout: 20000 });
  for (let i = 0; i < 6; i++) {
    await page.fill(`[data-otp-input="${i}"]`, CODE[i]);
    await sleep(90);
  }
  await sleep(6000);
  const text = await page.locator("body").innerText();
  log("post-verify url", page.url());
  log("post-verify msg", text.split("\n").filter((l) => /incorrect|expired|too many|error|verification code|Enter verification|Sent to|Sending/i.test(l)).slice(0, 6));
  const alert = page.locator('[role="alert"]');
  if (await alert.count()) log("alert:", await alert.first().innerText());
  return !/Enter verification code/i.test(text);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const log = (...a) => console.log(...a);
try {
  await page.goto(`${BASE}/#/auth`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  log("START", page.url());

  if (!(await login(page, A))) throw new Error("A login blocked");
  log("A after login", page.url());
  await sleep(2000);

  await page.goto(`${BASE}/#/account/notifications`, { waitUntil: "domcontentloaded" });
  await sleep(6000);
  await dismissPopup(page);
  log("A on notifications", page.url());
  const firstItem = page.locator('[role="button"], button').filter({ hasText: /Refund|Order|happy|Delivery|Prepared/ });
  if (await firstItem.count()) {
    await firstItem.first().click();
    await sleep(1200);
    log("A opened detail", page.url());
  } else {
    log("no notification item found");
  }

  // close the detail dialog if it opened
  if ((await page.locator('[role="dialog"]').count()) > 0) {
    await page.keyboard.press("Escape");
    await sleep(1200);
    if ((await page.locator('[role="dialog"]').count()) > 0) {
      await page.getByRole("button", { name: /^Close$/ }).first().click();
      await sleep(1000);
    }
  }
  log("dialogs left", await page.locator('[role="dialog"]').count());

  // logout via account sidebar
  await page.locator("button", { hasText: /^Logout$/ }).first().click();
  await sleep(7000);
  log("AFTER LOGOUT", page.url());
  log("hash after logout", await page.evaluate(() => location.hash));
  log("storage", await page.evaluate(() => Object.keys(localStorage)));
  const signedOut = await page.locator("body").innerText();
  log("signed-out landing has Sign In:", /Sign In|Sign in/i.test(signedOut));

  // B login from the page we land on (user clicks the site's own sign-in CTA)
  await page.goto(`${BASE}/#/`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await dismissPopup(page);
  const signIn = page.getByRole("button", { name: /^Sign In$/ }).first();
  if (await signIn.count()) {
    await signIn.click();
    await sleep(1800);
  } else {
    await page.goto(`${BASE}/#/auth`, { waitUntil: "domcontentloaded" });
    await sleep(1500);
  }
  log("B at auth", page.url());
  if (!(await login(page, B))) throw new Error("B login blocked");
  log("B after login", page.url());
  await sleep(2000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(5000);
  log("B after reload", page.url());
  const body = await page.locator("body").innerText();
  log("B identity lines", body.split("\n").filter((l) => /lisa|john|@gmail/i.test(l)).slice(0, 5));
  log("B lands on notifications page:", /notifications/i.test(page.url()) || /Notification/.test(body.slice(0, 400)));
} catch (e) {
  log("ERROR", e.message);
  log("url at error", page.url());
} finally {
  await browser.close();
}
