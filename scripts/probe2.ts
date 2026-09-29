import { chromium } from "playwright";

const BASE = "https://sunny-baths-help.freebuff.dev";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const convexUrls = new Set<string>();
  page.on("request", (r) => {
    if (r.url().includes("convex.cloud")) convexUrls.add(r.url().split("/api/")[0]);
  });

  await page.goto(BASE + "/#/products", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  // Products on the listing are clickable cards, so read the slugs the router
  // is actually offering by clicking the first card and reading the URL.
  const cardCount = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs.length;
  });

  await page.goto(BASE + "/#/products", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const firstCard = await page.$('[class*="cursor-pointer"]');
  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(2500);
  }
  console.log("convex urls:", [...convexUrls].join("\n"));
  console.log("url after click:", page.url());
  console.log("imgs:", cardCount);
  await browser.close();
})();
