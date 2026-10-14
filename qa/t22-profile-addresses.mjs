// Authenticated QA — Profile edit/persist + Addresses CRUD.
// Run: node qa/t22-profile-addresses.mjs
import { launch, go, report, interesting } from "./harness.mjs";
import { anonymousSignIn, injectSession, hash, pageSummary } from "./authSession.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();
const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};
const toasts = async () =>
  (await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => [])).map((t) => t.replace(/\s+/g, " ").trim());

const fill = async (sel, value) => {
  const el = page.locator(sel).first();
  await el.click().catch(() => {});
  await el.fill(value);
};

const session = await anonymousSignIn();
await go(page, "#/");
await injectSession(page, session);

// ══ 3. PROFILE ══
await go(page, "#/account/profile");
const before = await page.locator('input#name, input[name="name"], input').evaluateAll((els) =>
  els.slice(0, 4).map((e) => ({ id: e.id, type: e.type, value: e.value, ph: e.placeholder }))
);
R.profileFieldsBefore = before;
check("profile inputs load", before.length >= 3, JSON.stringify(before));

// invalid email guard
await fill('input#email', 'not-an-email');
await page.locator("button", { hasText: /^Save Changes$/ }).first().click();
await page.waitForTimeout(900);
let t = await toasts();
check("invalid email rejected client-side", t.some((x) => /valid email/i.test(x)), t.join(" | "));

// valid save
await fill('input#name', 'QA Test Customer');
await fill('input#email', 'qa.customer@example.com');
await fill('input#phone', '9876543210');
await page.locator("button", { hasText: /^Save( Changes)?$/ }).first().click();
await page.waitForTimeout(1600);
t = await toasts();
R.saveToast = t;
check("profile save succeeds", t.some((x) => /Profile updated successfully/i.test(x)), t.join(" | "));

// persistence after reload
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const after = await page.locator("input").evaluateAll((els) =>
  els.slice(0, 4).map((e) => ({ id: e.id, value: e.value }))
);
R.profileFieldsAfter = after;
check("profile persists after refresh (name)", after.some((f) => f.id === "name" && f.value === "QA Test Customer"), JSON.stringify(after));
check("profile persists after refresh (email)", after.some((f) => f.id === "email" && /@/.test(f.value)), JSON.stringify(after));
await page.screenshot({ path: "/tmp/qa-22-profile.png" });

// Back navigation from Profile
await page.goBack();
await page.waitForTimeout(1200);
check("Back from Profile returns to account", hash(page) === "/account", hash(page));

// ══ 4. ADDRESSES ══
await go(page, "#/account/addresses");
R.addressesInitial = await pageSummary(page);
const addFirst = page.locator("button", { hasText: /Add (Your First )?Address/i }).first();
check("addresses page has add CTA", (await addFirst.count()) > 0);

async function fillAddressDialog({ fullName, phone, houseFlat, street, area, city, state, pincode, landmark, makeDefault }) {
  await page.locator("button", { hasText: /^(Add|Add Your First) Address$/i }).first().click();
  await page.waitForTimeout(800);
  await fill("#fullName", fullName);
  await fill("#addrPhone", phone);
  await fill("#houseFlat", houseFlat);
  await fill("#street", street);
  await fill("#area", area);
  await fill("#city", city);
  // state select
  const stateTrigger = page.locator('[role="dialog"] button:has-text("Select state"), [role="dialog"] [role="combobox"]').first();
  if (await stateTrigger.count()) {
    await stateTrigger.click().catch(() => {});
    await page.waitForTimeout(500);
    const opt = page.locator('[role="option"]', { hasText: new RegExp(`^${state}$`, "i") }).first();
    if (await opt.count()) await opt.click().catch(() => {});
  }
  await fill("#pincode", pincode);
  await fill("#landmark", landmark);
  if (makeDefault) {
    const cb = page.locator('[role="dialog"] input[type="checkbox"]').first();
    if (await cb.count()) await cb.check().catch(() => {});
  }
}

// ── add default address ──
await fillAddressDialog({ fullName: "QA Test Customer", phone: "9876543210", houseFlat: "Flat 4B", street: "100ft Road", area: "Kalyan East", city: "Kalyan", state: "Maharashtra", pincode: "421306", landmark: "Near Anmol Garden", makeDefault: true });
await page.locator('[role="dialog"] button', { hasText: /^Add Address$/ }).first().click();
await page.waitForTimeout(2000);
t = await toasts();
R.addToast = t;
let addresses = await page.locator("main").innerText();
check("address created", /Flat 4B/.test(addresses) && /421306/.test(addresses), addresses.replace(/\s+/g, " ").slice(0, 160));
check("address marked default", /Default/i.test(addresses), addresses.replace(/\s+/g, " ").slice(0, 160));
await page.screenshot({ path: "/tmp/qa-22-address-added.png" });

// ── edit it ──
const editBtn = page.locator("main button", { hasText: /^Edit$/ }).first();
check("edit control present", (await editBtn.count()) > 0);
if (await editBtn.count()) {
  await editBtn.click();
  await page.waitForTimeout(900);
  await fill("#houseFlat", "Flat 9C");
  await page.locator('[role="dialog"] button', { hasText: /^Update Address$/ }).first().click();
  await page.waitForTimeout(1800);
  t = await toasts();
  R.editToast = t;
  addresses = await page.locator("main").innerText();
  check("address edit saved (Flat 9C)", /Flat 9C/.test(addresses), addresses.replace(/\s+/g, " ").slice(0, 160));
}

// ── add second address (non-default) ──
await fillAddressDialog({ fullName: "QA Test Customer", phone: "9876543210", houseFlat: "Office 22", street: "Station Road", area: "Thane West", city: "Thane", state: "Maharashtra", pincode: "421306", landmark: "Near Railway", makeDefault: false });
await page.locator('[role="dialog"] button', { hasText: /^Add Address$/ }).first().click();
await page.waitForTimeout(2000);
addresses = await page.locator("main").innerText();
check("second address added", /Office 22/.test(addresses) && /Flat 9C/.test(addresses), addresses.replace(/\s+/g, " ").slice(0, 200));
const defaultCount = (addresses.match(/Default/gi) || []).length;
check("exactly one default address", defaultCount === 1, `Default occurrences=${defaultCount}`);

// ── delete the second one ──
const delBtns = page.locator("main button", { hasText: /^Delete$/ });
const delCount = await delBtns.count();
check("delete controls present", delCount >= 1, `count=${delCount}`);
if (delCount >= 1) {
  // delete the non-default one (Office 22) — it is the one showing Delete
  const officeCard = page.locator("main").locator("div").filter({ hasText: /Office 22/ }).last();
  await officeCard.locator("button", { hasText: /^Delete$/ }).first().click().catch(async () => { await delBtns.last().click().catch(() => {}); });
  await page.waitForTimeout(800);
  const confirm = page.locator('[role="alertdialog"] button, [role="dialog"] button').filter({ hasText: /Delete/i }).last();
  if (await confirm.count()) await confirm.click().catch(() => {});
  await page.waitForTimeout(1800);
  t = await toasts();
  R.deleteToast = t;
  addresses = await page.locator("main").innerText();
  check("address deleted", !/Office 22/.test(addresses) && /Flat 9C/.test(addresses), addresses.replace(/\s+/g, " ").slice(0, 200));
}
await page.screenshot({ path: "/tmp/qa-22-addresses-final.png" });

// Back navigation
await page.goBack();
await page.waitForTimeout(1200);
check("Back from Addresses returns to account", hash(page) === "/account", hash(page));

R.consoleErrors = interesting(consoleErrors).filter((e) => !/pngtree|wikimedia|mankind|web-share|403/i.test(e)).slice(0, 8);
R.pageErrors = pageErrors;
R.badResponses = badResponses.filter((r) => !/pngtree|wikimedia|mankind/i.test(r)).slice(0, 5);

report("Test 22: profile + addresses (authenticated)", R);
console.log(`\n${R.failures.length ? "FAILURES:" : "ALL PROFILE/ADDRESS CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
await browser.close();
if (R.failures.length) process.exit(1);
