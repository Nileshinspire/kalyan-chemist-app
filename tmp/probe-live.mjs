import { chromium } from "playwright-core";
const BASE = "https://sunny-baths-help.freebuff.dev";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${String(e).slice(0, 400)}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url().slice(-90)} :: ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) logs.push(`[${r.status()}] ${r.url().slice(-90)}`); });
await page.goto(BASE + "/#/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => ({
  rootHTMLLen: (document.querySelector("#root")?.innerHTML || "").length,
  bodyText: (document.body.innerText || "").slice(0, 200),
  readyState: document.readyState,
  scripts: [...document.querySelectorAll("script")].map((s) => s.src.slice(-40)),
}));
console.log(JSON.stringify(info, null, 1));
console.log("---- logs ----");
console.log(logs.slice(0, 40).join("\n"));
await browser.close();
