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
  viewport: { width: 1000, height: 820 },
});
await ctx.addInitScript(
  ({ t2, ns }) => {
    localStorage.setItem(`__convexAuthJWT_${ns}`, t2);
    localStorage.setItem(`__convexAuthRefreshToken_${ns}`, newUser.tokens.refreshToken);
  },
  { t2: token, ns: NS },
);
const page = await ctx.newPage();

async function openModal() {
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
}

function measure(describe) {
  const el = page.locator('[role="dialog"]').evaluate((el) => {
    const r = el?.getBoundingClientRect();
    const inner = el?.querySelector('[class*="overflow-y-auto"]');
    const innerRect = inner?.getBoundingClientRect();
    const bodyRect = document.body.getBoundingClientRect();
    const bodyHorizontalScroll = document.body.scrollWidth > window.innerWidth;
    return {
      modal: { left: r?.left, right: r?.right, width: r?.width, height: r?.height },
      inner: {
        left: innerRect?.left,
        right: innerRect?.right,
        overflow: inner?.scrollWidth > (el?.clientWidth ?? 0),
      },
      body: {
        width: bodyRect.width,
        scrollWidth: document.body.scrollWidth,
        horizontalScroll: bodyHorizontalScroll,
        windowW: window.innerWidth,
      },
    };
  });
  console.log("measure", describe, JSON.stringify(measure()));
}

async function sectionsOk() {
  const body = await page.evaluate(() => document.body.innerHTML);
  const dialogInner = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    return {
      right: el?.getBoundingClientRect().right,
      windowW: window.innerWidth,
      innerHtml: el?.innerHTML?.slice(0, 400),
    };
  });
  console.log("sectionsOk", dialogInner.right, "<=", dialogInner.windowW + 2, "-- innerRight", dialogInner.right, "windowW", dialogInner.windowW);
  return dialogInner;
}

await openModal();
await measure("desktop 1000");
sectionsOk();
