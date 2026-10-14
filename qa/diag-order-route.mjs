// Diagnostic: what renders on /orders/<dummy-uuid> (standalone + account-nested).
import { launch, go, assertPreview } from "./harness.mjs";
import { anonymousSignIn, injectSession } from "./authSession.mjs";

await assertPreview();
const session = await anonymousSignIn();
const { browser, page, pageErrors, consoleErrors } = await launch();
await go(page, "#/");
for (let i = 0; i < 3; i++) {
  try { await injectSession(page, session); break; } catch { await page.waitForTimeout(900); }
}
const ID = "00000000-0000-0000-0000-000000000000";
for (const route of [`#/orders/${ID}`, `#/account/orders/${ID}`]) {
  await go(page, route);
  await page.waitForTimeout(2000);
  const snap = await page.evaluate(() => ({
    url: location.hash,
    mains: document.querySelectorAll("main").length,
    h1h2: [...document.querySelectorAll("h1,h2")].map((e) => e.innerText.trim()).slice(0, 4),
    bodyText: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 220),
  }));
  console.log(route, JSON.stringify(snap, null, 2));
}
// Recovery probe: after the boundary fires, does #/account render its main?
await go(page, "#/account");
await page.waitForTimeout(1500);
console.log("recovery /account:", JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  mains: document.querySelectorAll("main").length,
  text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160),
}))));
await go(page, `#/account/orders/${ID}`);
await page.waitForTimeout(1200);
await go(page, "#/account");
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log("nested recovery /account:", JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  mains: document.querySelectorAll("main").length,
  text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160),
}))));
console.log("pageErrors:", pageErrors.slice(0, 4));
console.log("consoleErrors:", consoleErrors.filter((e) => !/pngtree|wikimedia|mankind|403/i.test(e)).slice(0, 6));
await browser.close();
