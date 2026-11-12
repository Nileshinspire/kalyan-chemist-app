import { chromium } from "playwright-core";

const BASE = "https://dutiful-fox-804.convex.cloud";
const APP = "http://localhost:5173";
const NS = "httpsdutifulfox804convexcloud";
const stamp = Date.now();
const phone = `99${String(stamp).slice(-8)}`;
const password = "Layout12";

async function call(kind, path, args, token) {
  const r = await fetch(`${BASE}/api/${kind}`, {
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
const userId = (await call("query", "users:currentUser", {}, token))._id;

const cat = await call("mutation", "qaSetup:category", {
  name: `QA L ${stamp}`,
  slug: `qa-l-${stamp}`,
});
const product = await call("mutation", "qaSetup:product", {
  categoryId: cat,
  name: "QA Modal product",
  slug: `qa-modal-${stamp}`,
  price: 50,
  stockQuantity: 10,
  expiryDate: stamp + 180 * 24 * 60 * 60 * 1000,
});
await call("mutation", "qaSetup:receive", {
  productId: product,
  quantity: 5,
  batchNumber: "MOD-A",
  expiryDate: stamp + 60 * 24 * 60 * 60 * 1000,
});

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 768 },
});
await ctx.addInitScript(
  ({ t2, ns }) => {
    localStorage.setItem(`__convexAuthJWT_${ns}`, t2);
    localStorage.setItem(`__convexAuthRefreshToken_${ns}`, newUser.tokens.refreshToken);
  },
  { t2: token, ns: NS },
);
const page = await ctx.newPage();
await page.goto(`${APP}/#/admin/inventory`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await page.getByPlaceholder("Search products...").fill("QA Modal product");
await page.waitForTimeout(1200);
await page
  .locator("tr", { hasText: "QA Modal product" })
  .first()
  .getByRole("button", { name: /batches/i })
  .click();
await page.waitForTimeout(1800);

const d1 = await page.evaluate(() => {
  const el = document.querySelector('[role="dialog"]');
  const r = el?.getBoundingClientRect();
  const inner = el?.querySelector('[class*="overflow-y-auto"]');
  const innerRect = inner?.getBoundingClientRect();
  return { modal: r, inner, scrollWidth: inner?.scrollWidth, innerWidth: inner?.clientWidth };
});
console.log("1366x768", JSON.stringify(d1));
