#!/usr/bin/env bun
/**
 * Discount engine — live deployment QA (read-only + negative write checks).
 *
 * Verifies, against the real Convex deployment the storefront talks to:
 *   1. The homepage discount section resolves and every product it lists has a
 *      consistent price/badge pair (badge % ≥ advertised minimum, final price
 *      strictly below MRP, nothing free or negative).
 *   2. The admin config query refuses non-admin callers (read-side guard).
 *   3. Rule changes require an admin: an unauthenticated `setConfig` call is
 *      rejected, and a signed-in non-admin customer session is rejected too.
 *
 * Read-only with respect to data: the only "writes" attempted are negative
 * authorization probes that the backend is expected to refuse, so this script
 * never produces a real promotion or an audit-log row.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..");

// Locate the deployment the storefront uses (same technique the other QA
// scripts here use: read the Convex URL out of the built entry HTML).
let convexUrl = null;
for (const dir of [join(ROOT, "dist"), join(ROOT, "build")]) {
  let html;
  try { html = readFileSync(join(dir, "index.html"), "utf8"); } catch { continue; }
  const m = html.match(/https:\/\/[a-z0-9-]+\.convex\.cloud/);
  if (m) { convexUrl = m[0]; break; }
}
if (!convexUrl) convexUrl = process.env.CONVEX_URL ?? "https://dutiful-fox-804.convex.cloud";
console.log("Deployment:", convexUrl);

async function callQuery(path, args = {}, token) {
  const res = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function callMutation(path, args = {}, token) {
  const res = await fetch(`${convexUrl}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function callAction(path, args = {}, token) {
  const res = await fetch(`${convexUrl}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const failures = [];
const checks = [];
const pass = (label) => { checks.push(1); console.log(`PASS ${label}`); };
const fail = (label, detail) => {
  checks.push(1);
  failures.push(`${label}: ${detail}`);
  console.error(`FAIL ${label}: ${detail}`);
};

// ── 1. Storefront read path ─────────────────────────────────────────────────
const pub = await callQuery("discountHighlights:getPublic");
if (pub.status !== 200 || pub.json?.status !== "success") {
  fail("getPublic resolves", JSON.stringify(pub.json).slice(0, 200));
} else {
  const value = pub.json.value;
  pass("getPublic resolves");
  if (!value.configured) {
    console.log("INFO no admin has configured a discount rule yet; section read path is healthy");
  } else {
    const pct = value.discountPercent;
    if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
      fail("configured percent sane", `got ${pct}`);
    } else pass(`configured percent sane (${pct}%)`);

    let consistent = true;
    for (const p of value.products) {
      const badge = p.discountPrice && p.discountPrice < p.price && p.price > 0
        ? Math.round(((p.price - p.discountPrice) / p.price) * 100)
        : 0;
      if (badge < pct || p.discountPrice == null || p.discountPrice <= 0 || p.discountPrice >= p.price) {
        consistent = false;
        fail("listed product price/badge consistent", `${p.name}: badge ${badge}% < min ${pct}% or price invalid`);
      }
    }
    if (consistent) pass(`all ${value.products.length} listed product(s) priced ≥ ${pct}% with a valid final price`);
  }
}

// ── 2. Admin config query refuses non-admins ────────────────────────────────
const anonConfig = await callQuery("discountHighlights:getConfig");
const anonConfigDenied =
  anonConfig.status !== 200 || anonConfig.json?.status === "error" || anonConfig.json?.value == null;
if (anonConfigDenied) pass("getConfig refuses anonymous callers");
else fail("getConfig refuses anonymous callers", "returned a value");

// ── 3. Anonymous setConfig is rejected ───────────────────────────────────────
const anonWrite = await callMutation("discountHighlights:setConfig", {
  discountPercent: 20,
  manualProductIds: [],
  isActive: true,
});
const anonWriteDenied =
  anonWrite.status !== 200 || anonWrite.json?.status === "error" || anonWrite.json?.errorMessage != null;
if (anonWriteDenied) pass("setConfig refuses anonymous callers");
else fail("setConfig refuses anonymous callers", "call succeeded without auth");

// ── 4. Signed-in non-admin (anonymous session) setConfig is rejected ────────
const signIn = await callAction("auth:signIn", { provider: "anonymous", params: {} });
if (signIn.status !== 200 || signIn.json?.status !== "success" || !signIn.json?.value?.tokens) {
  console.log("SKIP non-admin write probe: could not create an anonymous session");
} else {
  const token = signIn.json.value.tokens.token;
  const customerWrite = await callMutation(
    "discountHighlights:setConfig",
    { discountPercent: 20, manualProductIds: [], isActive: true },
    token,
  );
  const denied =
    customerWrite.status !== 200 || customerWrite.json?.status === "error" || customerWrite.json?.errorMessage != null;
  if (denied) pass("setConfig refuses a signed-in non-admin session");
  else fail("setConfig refuses a signed-in non-admin session", "non-admin write succeeded");

  const customerConfig = await callQuery("discountHighlights:getConfig", {}, token);
  const readDenied =
    customerConfig.status !== 200 || customerConfig.json?.status === "error" || customerConfig.json?.value == null;
  if (readDenied) pass("getConfig refuses a signed-in non-admin session");
  else fail("getConfig refuses a signed-in non-admin session", "non-admin read succeeded");
}

console.log("");
if (failures.length > 0) {
  console.error(`FAILED ${failures.length}/${checks.length} checks`);
  process.exit(1);
}
console.log(`PASSED all ${checks.length} live checks`);
