// Quick probe: does the preview app mount? Captures console, errors, body size.
import { chromium } from "playwright-core";

const url = process.argv[2] || "https://sunny-baths-help.freebuff.dev/#/";
const w = parseInt(process.argv[3] || "375", 10);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: w, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${String(e).slice(0, 500)}`));
page.on("requestfailed", (r) =>
  logs.push(`[reqfail] ${r.url().slice(0, 160)} :: ${r.failure()?.errorText}`)
);
page.on("response", (r) => {
  if (r.status() >= 400) logs.push(`[${r.status()}] ${r.url().slice(0, 160)}`);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(8000);

const info = await page.evaluate(() => ({
  readyState: document.readyState,
  bodyChildren: document.body?.children.length,
  rootHTML: (document.getElementById("root")?.innerHTML || "").slice(0, 400),
  bodyText: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300),
  scrollHeight: document.body.scrollHeight,
  scripts: [...document.querySelectorAll("script")].map((s) => s.src || s.type).slice(0, 8),
}));

console.log(JSON.stringify(info, null, 2));
console.log("\n--- logs ---");
console.log(logs.slice(0, 40).join("\n"));

await browser.close();
