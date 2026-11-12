import { chromium } from "playwright-core";

const APP = "http://localhost:5173";
const NS = "httpsdutifulfox804convexcloud";
const stamp = Date.now();
const phone = `99${String(stamp).slice(-8)}`;
const password = "Layout12";

async function call(kind, path, args, token) {
  const r = await fetch("https://dutiful-fox-804.convex.cloud/api/" + kind, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const t = await r.text();
  const j = JSON.parse(t);
  if (j.status === "error") throw new Error(j.errorMessage);
  return j.value !== undefined ? j.value : j;
}

const newUser = await call(
  "action",
  "auth:signIn",
  {
    provider: "phone-password",
    params: { flow: "signUp", phone, password, name: `QA Layout ${stamp}` },
  },
  "",
);
const token = newUser.tokens.token;
await call("mutation", "qaSetup:promote", { userId: (await call("query", "users:currentUser", {}, token))._id });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
await ctx.addInitScript(
  ({ t2, ns }) => {
    localStorage.setItem(`__convexAuthJWT_${ns}`, t2);
    localStorage.setItem(`__convexAuthRefreshToken_${ns}`, newUser.tokens.refreshToken);
  },
  { t2: token, ns: NS },
);

const sizes = [
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [390, 844],
];

for (const [w, h] of sizes) {
  await ctx.setViewportSize({ width: w, height: h });
  const page = await ctx.newPage();
  await page.goto(`${APP}/#/admin/inventory`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.getByPlaceholder("Search products...").fill("QA Modal product");
  await page.waitForTimeout(1200);
  try {
    await page.locator("tr", { hasText: "QA Modal product" }).first().getByRole("button", { name: /batches/i }).click();
    await page.waitForTimeout(1800);
  } catch {}
  const overflow = await page.evaluate(() => ({
    bodyHorizontalScroll: document.body.scrollWidth > window.innerWidth,
    bodyW: document.body.clientWidth,
    bodySW: document.body.scrollWidth,
    windowW: window.innerWidth,
    windowH: window.innerHeight,
    dialogW: document.querySelector('[role="dialog"]')?.getBoundingClientRect().width,
    dialogRight: document.querySelector('[role="dialog"]')?.getBoundingClientRect().right,
  }));
  console.log(`${w}x${h}`, JSON.stringify(overflow));
  await page.close();
}
await browser.close();
