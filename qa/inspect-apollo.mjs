// Debug inspect: print url, status, and main-content presence per width.
import { chromium } from "playwright-core";

const WIDTHS = process.argv.slice(2).map((n) => Number(n));
const HEIGHT = 844;
const URL = "https://www.apollopharmacy.in/";

async function main() {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    try {
      const resp = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
      console.log(`\n=== ${width}px — status=${resp?.status} finalUrl=${page.url()} ===`);
      await page.waitForTimeout(4000);
      const title = await page.title();
      console.log(`title: ${title}`);
      const visibleText = await page.evaluate(() => document.body.innerText.slice(0, 300));
      console.log(`bodyText[:300]: ${JSON.stringify(visibleText)}`);
      const mainCount = await page.locator("main").count();
      console.log(`main elements: ${mainCount}`);
      const html = await page.innerHTML("body");
      console.log(`body length: ${html.length}`);
      // dump what snippets we can find
      const sel = await page.evaluate(() => {
        const h = document.querySelector("header");
        return { header: !!(h && h.children.length), nav: !!document.querySelector("nav"), h1: !!document.querySelector("h1"), input: !!document.querySelector("input"), img: document.images.length };
      });
      console.log(`selectors: ${JSON.stringify(sel)}`);
    } catch (e) {
      console.log(`ERROR on ${width}: ${e.message}`);
    }
    await page.close();
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
