import { chromium } from "playwright";

const BASE = "https://sunny-baths-help.freebuff.dev";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE " + m.text().slice(0, 200));
  });

  await page.goto(BASE + "/#/products", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => ({
    title: document.title,
    h1: Array.from(document.querySelectorAll("h1")).map((e) => e.textContent?.trim()),
    anchorSample: Array.from(document.querySelectorAll("a"))
      .slice(0, 25)
      .map((a) => a.getAttribute("href")),
    bodyLen: document.body.innerText.length,
    bodyHead: document.body.innerText.slice(0, 400),
  }));
  console.log(JSON.stringify(info, null, 2));
  console.log("ERRORS:\n" + errors.slice(0, 15).join("\n"));
  await browser.close();
})();
