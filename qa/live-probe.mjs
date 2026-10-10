// Probe the live preview deployment: does the SPA actually mount, and how long
// does it take? Reports body text length, section count and any page errors.
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "https://sunny-baths-help.freebuff.dev";
const W = Number(process.env.W || 390);
const ROUTE = process.env.ROUTE || "#/";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: W, height: 844 },
  isMobile: W < 768,
  hasTouch: W < 768,
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200));
});

await page.goto(`${BASE}/${ROUTE}`, { waitUntil: "domcontentloaded", timeout: 60000 });
let textLen = 0;
let waited = "0s";
for (let i = 0; i < 20; i++) {
  waited = `${(i + 1) * 1.5}s`;
  await page.waitForTimeout(1500);
  textLen = await page.evaluate(() => (document.body.innerText || "").trim().length);
  if (textLen > 500) break;
}
const snap = await page.evaluate(() => ({
  textLen: (document.body.innerText || "").trim().length,
  sections: document.querySelectorAll("section").length,
  h2s: [...document.querySelectorAll("h2")].slice(0, 6).map((e) => e.innerText.trim().slice(0, 30)),
  header: !!document.querySelector("header"),
  bodyH: document.body.scrollHeight,
}));
console.log(JSON.stringify({ waited, ...snap, errors: errs.slice(0, 6) }, null, 2));
await browser.close();
