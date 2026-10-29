// Verifies the sign-out / account-identity contract the auth fix relies on,
// against the real app running on the preview:
//
//   1. Account A signs in  -> UI renders A's profile.
//   2. Sign Out            -> tokens erased, UI signed out, /admin unreachable.
//   3. Account B signs in  -> UI renders B, never A.
//   4. Reload              -> still B.
//   5. Back to A (fresh sign-in for the same account) -> UI renders A again.
//
// Sessions are created through the app's own Convex Auth providers
// (phone-password, which needs no external service), and every identity claim
// is checked twice: from the rendered page ("Welcome back, <name>") and from
// the user id that the stored session token resolves to server-side.
import { chromium } from "playwright-core";
import { BASE, assertPreview, interesting } from "./harness.mjs";

const NAMES = { A: "QA Account Alpha", B: "QA Account Bravo" };
const CREDS = {
  A: { phone: "+919000000001", password: "qa-alpha-pass-1" },
  B: { phone: "+919000000002", password: "qa-bravo-pass-2" },
};

async function convexUrl() {
  const html = await (await fetch(BASE + "/")).text();
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const s of srcs) {
    const js = await (await fetch(new URL(s, BASE))).text();
    const m = js.match(/https:\/\/[a-z0-9-]+\.convex\.cloud/);
    if (m) return m[0];
  }
  throw new Error("convex url not found in bundle");
}

async function post(url, kind, path, args, token) {
  const res = await fetch(`${url}/api/${kind}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  return res.json();
}

async function phoneSignIn(url, creds, flow) {
  const json = await post(url, "action", "auth:signIn", {
    provider: "phone-password",
    params: { flow, phone: creds.phone, password: creds.password },
  });
  if (json?.status !== "success" || !json.value?.tokens) {
    throw new Error(
      `${flow} failed for ${creds.phone}: ` + JSON.stringify(json).slice(0, 300),
    );
  }
  return json.value.tokens;
}

async function ensureAccount(url, creds, name) {
  let tokens;
  try {
    tokens = await phoneSignIn(url, creds, "signIn");
  } catch {
    tokens = await phoneSignIn(url, creds, "signUp");
  }
  const patched = await post(
    url,
    "mutation",
    "users:updateProfile",
    { name },
    tokens.token,
  );
  if (patched?.status !== "success") {
    throw new Error("updateProfile failed: " + JSON.stringify(patched).slice(0, 300));
  }
  const me = await post(url, "query", "users:currentUser", {}, tokens.token);
  return { tokens, userId: me?.value?._id };
}

async function inject(page, url, tokens) {
  const ns = url.replace(/[^a-zA-Z0-9]/g, "");
  await page.evaluate(
    ({ token, refreshToken, ns }) => {
      localStorage.setItem(`__convexAuthJWT_${ns}`, token);
      localStorage.setItem(`__convexAuthRefreshToken_${ns}`, refreshToken);
    },
    { token: tokens.token, refreshToken: tokens.refreshToken, ns },
  );
}

async function greeting(page) {
  await page
    .locator("h1", { hasText: /Welcome back/ })
    .first()
    .waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  return page.locator("h1").first().innerText();
}

async function pageIdentity(page, url) {
  const token = await page.evaluate(
    (ns) => localStorage.getItem(`__convexAuthJWT_${ns}`),
    url.replace(/[^a-zA-Z0-9]/g, ""),
  );
  if (!token) return null;
  const me = await post(url, "query", "users:currentUser", {}, token);
  return me?.value?._id ?? null;
}

async function storedToken(page, url) {
  return page.evaluate(
    (ns) => localStorage.getItem(`__convexAuthJWT_${ns}`),
    url.replace(/[^a-zA-Z0-9]/g, ""),
  );
}

async function loadWith(page, url, tokens) {
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: "domcontentloaded" });
  await inject(page, url, tokens);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

async function signOut(page) {
  await page.locator("button", { hasText: /^Sign Out$/ }).first().click();
  await page.waitForTimeout(2500);
}

async function main() {
  await assertPreview();
  const url = await convexUrl();

  const A = await ensureAccount(url, CREDS.A, NAMES.A);
  const B = await ensureAccount(url, CREDS.B, NAMES.B);
  if (!A.userId || !B.userId || A.userId === B.userId) {
    throw new Error("QA accounts are not distinct");
  }

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  const results = {};

  // 1. Account A
  await loadWith(page, url, A.tokens);
  results.accountA = await greeting(page);
  results.accountAIdentity = (await pageIdentity(page, url)) === A.userId;

  // 2. Sign out
  await signOut(page);
  results.afterSignOutToken = await storedToken(page, url);
  results.afterSignOutHash = page.url().split("#")[1] || "/";
  await page.goto(`${BASE}/#/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  results.adminWhileSignedOut = page.url().split("#")[1] || "/";
  // The sign-in page itself must render (no error boundary) after a sign-out.
  const authBody = await page.locator("body").innerText();
  results.signInPageRendered = /Send Code/.test(authBody);
  results.errorBoundary = /Something went wrong/.test(authBody);

  // 3. Account B
  await loadWith(page, url, B.tokens);
  results.accountB = await greeting(page);
  results.accountBIdentity = (await pageIdentity(page, url)) === B.userId;

  // 4. Reload keeps B
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  results.accountBAfterReload = await greeting(page);
  results.accountBIdentityAfterReload = (await pageIdentity(page, url)) === B.userId;

  // 5. Sign out of B, then a fresh sign-in for A
  await signOut(page);
  results.afterSignOutBToken = await storedToken(page, url);
  const aAgain = await phoneSignIn(url, CREDS.A, "signIn");
  await loadWith(page, url, aAgain);
  results.accountAAgain = await greeting(page);
  results.accountAAgainIdentity = (await pageIdentity(page, url)) === A.userId;

  results.pageErrors = interesting(pageErrors);
  await browser.close();

  const ok =
    results.accountA.includes(NAMES.A) &&
    results.accountAIdentity &&
    results.afterSignOutToken === null &&
    /\/(auth|login)/.test(results.afterSignOutHash) &&
    /\/(auth|admin\/login)/.test(results.adminWhileSignedOut) &&
    results.accountB.includes(NAMES.B) &&
    results.accountBIdentity &&
    results.signInPageRendered &&
    !results.errorBoundary &&
    results.accountBAfterReload.includes(NAMES.B) &&
    results.accountBIdentityAfterReload &&
    results.afterSignOutBToken === null &&
    results.accountAAgain.includes(NAMES.A) &&
    results.accountAAgainIdentity &&
    results.pageErrors.length === 0;

  console.log(JSON.stringify({ ok, ...results }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
