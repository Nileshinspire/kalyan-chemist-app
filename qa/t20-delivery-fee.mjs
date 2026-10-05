// Runtime verification of the delivery-fee consistency fix:
//   1. Sign in (anonymous provider — the app's own auth config enables it)
//   2. Add an item below the free-delivery threshold
//   3. Cart fee vs Checkout fee vs expected server fee — must be identical
//   4. Checkout total must include that same fee
//   5. Repeat above the threshold
// Run: node qa/t20-delivery-fee.mjs
import { launch, go, report, interesting } from "./harness.mjs";

const BASE = "https://sunny-baths-help.freebuff.dev";
const results = {};
const fail = (m) => { results.__failures = results.__failures || []; results.__failures.push(m); };

// ── 0. Discover the Convex URL from the served bundle ──
const convexUrl = await (async () => {
  const html = await (await fetch(BASE + "/")).text();
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const s of srcs) {
    const js = await (await fetch(new URL(s, BASE))).text();
    const m = js.match(/https:\/\/[a-z0-9-]+\.convex\.cloud/);
    if (m) return m[0];
  }
  throw new Error("convex url not found in bundle");
})();
results.convexUrl = convexUrl;

// ── 1. Anonymous sign-in via the same Convex action the app client calls ──
const signInRes = await fetch(`${convexUrl}/api/action`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "auth:signIn", args: { provider: "anonymous", params: {} } }),
});
const signInJson = await signInRes.json().catch(() => null);
if (signInJson?.status !== "success" || !signInJson.value?.tokens) {
  console.log("SIGNIN_FAILED", JSON.stringify(signInJson).slice(0, 600));
  process.exit(1);
}
const { token, refreshToken } = signInJson.value.tokens;
const ns = convexUrl.replace(/[^a-zA-Z0-9]/g, "");

// ── Live delivery config (same public query the app uses) ──
const cfg = (await (await fetch(`${convexUrl}/api/query`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "deliveryConfig:getPublic", args: {} }),
})).json())?.value;
results.liveConfig = {
  defaultDeliveryFee: cfg?.defaultDeliveryFee,
  freeDeliveryThreshold: cfg?.freeDeliveryThreshold,
};
// Expected server fee for a cart with no pincode-context / a pincode without override
const expectedFee = (sub) => (cfg ? (sub >= cfg.freeDeliveryThreshold ? 0 : cfg.defaultDeliveryFee) : sub >= 500 ? 0 : 49);

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

// Inject session into localStorage the way @convex-dev/auth stores it
await go(page, "#/");
await page.evaluate(({ token, refreshToken, ns }) => {
  localStorage.setItem(`__convexAuthJWT_${ns}`, token);
  localStorage.setItem(`__convexAuthRefreshToken_${ns}`, refreshToken);
}, { token, refreshToken, ns });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

// Confirm signed in: cart page must no longer show the sign-in gate
await go(page, "#/cart");
const gateText = await page.locator("h1").first().innerText().catch(() => "");
results.cartAuthGate = gateText;
if (/Sign In to Shop/i.test(gateText)) { fail("anonymous session not accepted (cart still gated)"); }

// ── helpers ──
async function readSummary(p) {
  return p.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    const row = (label) => {
      const el = spans.find((e) => e.textContent.trim().startsWith(label));
      return el?.parentElement ? el.parentElement.innerText.replace(/\s*\n\s*/g, " ").trim() : null;
    };
    const trustMatches = [...document.querySelectorAll("div")].filter(
      (d) => /^Free delivery/.test(d.innerText.trim()) && d.children.length <= 2
    );
    return {
      subtotal: row("Subtotal"),
      discount: row("Discount"),
      gst: row("GST"),
      delivery: row("Delivery"),
      total: row("Total"),
      trustLine: trustMatches.length ? trustMatches[trustMatches.length - 1].innerText.replace(/\s*\n\s*/g, " ").trim() : null,
    };
  });
}
const rupee = (s) => {
  if (s == null) return null;
  const m = s.match(/₹\s?([\d,]+)/);
  if (m) return Number(m[1].replace(/,/g, ""));
  return /\bFree\b/.test(s) ? 0 : null;
};

async function addCheapestProduct() {
  await go(page, "#/products?nav=all&sort=price_asc");
  await page.waitForTimeout(800);
  const href = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="#/products/"]')].find((x) => /\/products\/.+/.test(x.getAttribute("href") || ""));
    return a ? a.getAttribute("href") : null;
  });
  if (!href) { fail("no product link found (price_asc)"); return null; }
  await go(page, href.replace(/^#/, ""));
  const name = await page.locator("h1").first().innerText().catch(() => "?");
  const addBtn = page.locator("button", { hasText: /Add to Cart/i }).first();
  if (!(await addBtn.count())) { fail(`no Add to Cart button on ${name}`); return null; }
  await addBtn.click().catch(() => {});
  await page.waitForTimeout(1500);
  return { name: name.trim(), href };
}

async function addMostExpensiveProduct() {
  await go(page, "#/products?nav=all&sort=price_desc");
  await page.waitForTimeout(800);
  const href = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href*="#/products/"]')].find((x) => /\/products\/.+/.test(x.getAttribute("href") || ""));
    return a ? a.getAttribute("href") : null;
  });
  if (!href) { fail("no product link found (price_desc)"); return null; }
  await go(page, href.replace(/^#/, ""));
  const name = await page.locator("h1").first().innerText().catch(() => "?");
  const addBtn = page.locator("button", { hasText: /Add to Cart/i }).first();
  if (!(await addBtn.count())) { fail(`no Add to Cart button on ${name}`); return null; }
  await addBtn.click().catch(() => {});
  await page.waitForTimeout(1500);
  return { name: name.trim(), href };
}

async function bumpQtyUntil(minSubtotal) {
  // Increase first cart item quantity until subtotal reaches minSubtotal
  for (let i = 0; i < 45; i++) {
    const s = await page.evaluate(() => {
      const spans = [...document.querySelectorAll("span")];
      const el = spans.find((e) => e.textContent.trim().startsWith("Subtotal"));
      const m = el?.parentElement?.innerText.match(/₹\s?([\d,]+)/);
      return m ? Number(m[1].replace(/,/g, "")) : 0;
    });
    if (s >= minSubtotal) return s;
    const plus = page.locator("button:has(svg.lucide-plus)").first();
    if (!(await plus.count())) return s;
    await plus.click().catch(() => {});
    await page.waitForTimeout(450);
  }
  return -1;
}

async function captureScenario(label) {
  // Cart
  await go(page, "#/cart");
  const cart = await readSummary(page);
  // Checkout
  await go(page, "#/checkout");
  await page.waitForTimeout(1200);
  const checkout = await readSummary(page);

  const cartFee = rupee(cart.delivery);
  const coFee = rupee(checkout.delivery);
  const coSub = rupee(checkout.subtotal);
  const coDisc = rupee(checkout.discount) || 0;
  const coGst = rupee(checkout.gst);
  const coTotal = rupee(checkout.total);
  const expected = expectedFee(coSub - coDisc); // server base = net subtotal

  const out = {
    label,
    cart: { delivery: cart.delivery, total: cart.total, trustLine: cart.trustLine },
    checkout: {
      subtotal: checkout.subtotal,
      discount: checkout.discount,
      gst: checkout.gst,
      delivery: checkout.delivery,
      total: checkout.total,
      trustLine: checkout.trustLine,
    },
    parsed: { cartFee, coFee, expectedServerFee: expected, coSub, coDisc, coGst, coTotal },
  };
  await page.screenshot({ path: `/tmp/qa-20-checkout-${label}.png` });

  if (cartFee == null || coFee == null) fail(`${label}: could not parse fee rows (cart=${cart.delivery}, checkout=${checkout.delivery})`);
  else {
    if (cartFee !== coFee) fail(`${label}: Cart fee ${cartFee} !== Checkout fee ${coFee}`);
    if (coFee !== expected) fail(`${label}: Checkout fee ${coFee} !== expected server fee ${expected}`);
  }
  if (coTotal != null && coSub != null && coGst != null && coFee != null) {
    const composed = coSub - coDisc + coGst + coFee;
    if (composed !== coTotal) fail(`${label}: Checkout total ${coTotal} != sub-disc+gst+fee ${composed}`);
  }
  if (cart.trustLine && checkout.trustLine && cart.trustLine !== checkout.trustLine) {
    fail(`${label}: trust lines differ — Cart "${cart.trustLine}" vs Checkout "${checkout.trustLine}"`);
  }
  return out;
}

// ── 2. Below threshold ──
results.added1 = await addCheapestProduct();
await go(page, "#/cart");
results.belowSubtotal = await page.evaluate(() => {
  const spans = [...document.querySelectorAll("span")];
  const el = spans.find((e) => e.textContent.trim().startsWith("Subtotal"));
  const m = el?.parentElement?.innerText.match(/₹\s?([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
});
if (results.belowSubtotal != null && results.belowSubtotal >= (cfg?.freeDeliveryThreshold ?? 500)) {
  fail(`cheapest product already >= threshold (${results.belowSubtotal}) — below-threshold scenario invalid`);
}
results.below = await captureScenario("below");

// ── 3. Above threshold ──
results.added2 = await addMostExpensiveProduct();
await go(page, "#/cart");
const bumpedTo = await bumpQtyUntil((cfg?.freeDeliveryThreshold ?? 500));
results.aboveSubtotal = bumpedTo;
if (bumpedTo >= 0 && bumpedTo < (cfg?.freeDeliveryThreshold ?? 500)) {
  fail(`could not reach threshold (subtotal ${bumpedTo})`);
}
results.above = await captureScenario("above");

// ── cleanup: clear the test cart ──
await go(page, "#/cart");
const clearBtn = page.locator("button", { hasText: /Clear Cart/i }).first();
if (await clearBtn.count()) { await clearBtn.click().catch(() => {}); await page.waitForTimeout(1000); }

results.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind/i.test(e)).slice(0, 10);
results.pageErrors = pageErrors;
results.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 20: delivery fee consistency (Cart vs Checkout vs server)", results);
if (results.__failures?.length) {
  console.log("\nFAILURES:");
  for (const f of results.__failures) console.log(" - " + f);
  process.exit(1);
}
console.log("\nALL DELIVERY-FEE CONSISTENCY CHECKS PASSED");
await browser.close();
