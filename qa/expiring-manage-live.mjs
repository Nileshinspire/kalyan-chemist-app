#!/usr/bin/env bun
/**
 * Expiring Medicines "Manage" — live deployment QA (browser + API probes).
 *
 * Verifies against the real deployment the storefront talks to:
 *   1. Backend authz: `adminProducts:getExpiringMedicines` refuses anonymous
 *      AND signed-in non-admin callers; `adminInventory:updateExpiry` refuses
 *      anonymous callers (expiry edits are admin-only on the backend).
 *   2. Storefront purchase block: `cart:addItem` refuses the expired medicine
 *      for a signed-in customer, using the real product row.
 *   3. UI: the expired medicine's product page shows the expired state and
 *      disables Buy Now / Add to Cart with an "Expired" label.
 *   4. Admin route protection: a signed-out visit to /admin/expiring is
 *      redirected to auth.
 *
 * Every data-changing probe passes values that are no-ops if they were to
 * (incorrectly) succeed — the expiry probe writes back the product's CURRENT
 * expiry date and the stock probe writes back the CURRENT quantity — so a
 * broken authz check can never corrupt data from running this script.
 */
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = "https://sunny-baths-help.freebuff.dev";
const CONVEX = "https://dutiful-fox-804.convex.cloud";

async function callQuery(p, args = {}, token) {
  const res = await fetch(`${CONVEX}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ path: p, args, format: "json" }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function callMutation(p, args = {}, token) {
  const res = await fetch(`${CONVEX}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ path: p, args, format: "json" }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function callAction(p, args = {}) {
  const res = await fetch(`${CONVEX}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: p, args, format: "json" }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const failures = [];
const pass = (label) => console.log(`PASS ${label}`);
const fail = (label, detail) => {
  failures.push(label);
  console.error(`FAIL ${label} — ${detail}`);
};
const errorText = (r) =>
  r.json?.errorMessage || r.json?.value?.message || JSON.stringify(r.json).slice(0, 200);
const isDenied = (r, re) =>
  r.status !== 200 || r.json?.status === "error" || (r.json?.value == null && re.test(errorText(r)));

// ── 0. Deployment health + anonymous session ────────────────────────────────
{
  let body = "";
  try {
    const res = await fetch(BASE + "/", { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`[ENVIRONMENT BLOCKED] preview HTTP ${res.status}`);
      process.exit(78);
    }
    body = await res.text();
  } catch (e) {
    console.error(`[ENVIRONMENT BLOCKED] preview unreachable: ${e.message}`);
    process.exit(78);
  }
  if (/deployment has been disabled|usage limit/i.test(body)) {
    console.error("[ENVIRONMENT BLOCKED] Convex deployment disabled / usage limit hit");
    process.exit(78);
  }
}
const signIn = await callAction("auth:signIn", { provider: "anonymous", params: {} });
const token = signIn.json?.value?.tokens?.token;
if (!token) {
  console.error("[ENVIRONMENT BLOCKED] could not create an anonymous session");
  process.exit(78);
}

// ── 1. Resolve the expired medicine through the public product search UI ────
const executablePath =
  process.env.CHROME_PATH ||
  path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome");
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const pageErrors = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
page.on("pageerror", (e) => pageErrors.push(String(e)));

let slug = null;
let product = null;
{
  // Resolve identity through the same public APIs the storefront uses
  // (autocomplete → getBySlug), not by guessing selectors.
  const ac = await callQuery("publicProducts:autocomplete", { query: "glucon" });
  const hit = Array.isArray(ac.json?.value)
    ? ac.json.value.find((x) => /glucon/i.test(x?.name || ""))
    : null;
  if (hit?.slug) slug = hit.slug;
  if (slug) {
    const r = await callQuery("products:getBySlug", { slug });
    if (r.json?.status === "success" && r.json.value) product = r.json.value;
  }
  if (!product) {
    await browser.close();
    console.error("FAIL resolve expired medicine: glucon-D not found via public APIs");
    process.exit(1);
  }
  pass(`resolved expired medicine "${product.name}" (slug=${slug}, expiry=${new Date(product.expiryDate).toISOString().slice(0, 10)}, stock=${product.stockQuantity})`);
}

// ── 2. Backend authz probes ─────────────────────────────────────────────────
{
  // Expiring list: refuses anonymous callers.
  const anonList = await callQuery("adminProducts:getExpiringMedicines");
  if (isDenied(anonList, /Not authenticated/i)) pass("getExpiringMedicines refuses anonymous callers");
  else fail("getExpiringMedicines refuses anonymous callers", errorText(anonList));

  // Expiring list: refuses a signed-in NON-admin customer.
  const custList = await callQuery("adminProducts:getExpiringMedicines", {}, token);
  if (custList.json?.status === "error" && /Not authorized/i.test(errorText(custList)))
    pass("getExpiringMedicines refuses a signed-in non-admin");
  else fail("getExpiringMedicines refuses a signed-in non-admin", errorText(custList));

  // Expiry edit: refuses anonymous callers (writes back the SAME date so the
  // probe is a no-op even if the check were missing).
  const anonEdit = await callMutation("adminInventory:updateExpiry", {
    productId: product._id,
    expiryDate: product.expiryDate,
  });
  if (isDenied(anonEdit, /Not authenticated/i)) pass("updateExpiry refuses anonymous callers");
  else fail("updateExpiry refuses anonymous callers", errorText(anonEdit));

  // Expiry edit: refuses a signed-in non-admin (same no-op value).
  const custEdit = await callMutation(
    "adminInventory:updateExpiry",
    { productId: product._id, expiryDate: product.expiryDate },
    token
  );
  if (custEdit.json?.status === "error" && /Not authorized/i.test(errorText(custEdit)))
    pass("updateExpiry refuses a signed-in non-admin");
  else fail("updateExpiry refuses a signed-in non-admin", errorText(custEdit));

  // Stock adjust: refuses a signed-in non-admin (writes back the SAME quantity).
  const custStock = await callMutation(
    "adminInventory:adjustStock",
    {
      productId: product._id,
      newQuantity: product.stockQuantity,
      reason: "QA authz probe (no-op)",
    },
    token
  );
  if (custStock.json?.status === "error" && /Not authorized/i.test(errorText(custStock)))
    pass("adjustStock refuses a signed-in non-admin");
  else fail("adjustStock refuses a signed-in non-admin", errorText(custStock));
}

// ── 3. Server-side cart block for the expired medicine ──────────────────────
{
  const add = await callMutation(
    "cart:addItem",
    { productId: product._id, quantity: 1 },
    token
  );
  const msg = errorText(add);
  if (add.json?.status === "error" && /expired/i.test(msg))
    pass("cart:addItem refuses the expired medicine for a signed-in customer");
  else fail("cart:addItem refuses the expired medicine", msg);
}

// ── 4. Product page shows the expired state and disables purchase ───────────
{
  // Re-navigate to the product detail route we already resolved.
  await page.goto(`${BASE}/#/products/${slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const body = await page.locator("body").innerText();

  if (/Expired — not available for sale/.test(body))
    pass("product page shows the expired status");
  else fail("product page shows the expired status", "expired status text not found");

  const buyNow = page.locator('button:has-text("Buy Now")').first();
  const addBtn = page
    .locator('button:has-text("Add to Cart"), button:has-text("Expired")')
    .first();
  const buyDisabled = (await buyNow.count()) && (await buyNow.isDisabled());
  const addText = (await addBtn.count()) ? (await addBtn.innerText()).trim() : "";
  const addDisabled = (await addBtn.count()) && (await addBtn.isDisabled());

  if (buyDisabled) pass("Buy Now is disabled for the expired medicine");
  else fail("Buy Now is disabled for the expired medicine", "button not found or still enabled");
  if (/Expired/.test(addText) && addDisabled)
    pass('Add to Cart reads "Expired" and is disabled');
  else fail('Add to Cart reads "Expired" and is disabled', `text="${addText}" disabled=${addDisabled}`);

  if (pageErrors.length === 0) pass("product page has no runtime errors");
  else fail("product page has no runtime errors", pageErrors.join(" | "));

  await page.screenshot({ path: "qa/expiring-detail-desktop.png" });
}

// ── 5. Signed-out admin route protection ────────────────────────────────────
{
  const anon = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await anon.goto(`${BASE}/#/admin/expiring`, { waitUntil: "domcontentloaded" });
  await anon.waitForTimeout(3500);
  const url = anon.url();
  const body = await anon.locator("body").innerText();
  if (/\/auth|\/admin\/login/.test(url) || /sign in|access denied/i.test(body))
    pass("signed-out /admin/expiring redirects to auth");
  else fail("signed-out /admin/expiring redirects to auth", `url=${url}`);
  await anon.screenshot({ path: "qa/expiring-admin-redirect.png" });
  await anon.close();
}

await browser.close();
console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("All Expiring Medicines live checks passed");
