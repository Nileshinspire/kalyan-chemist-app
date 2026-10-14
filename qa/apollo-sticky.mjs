// Apollo mobile: computed sticky styles of header wrapper
import { chromium } from "playwright-core";

const WIDTH = Number(process.argv[2] || 390);

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto("https://www.apollopharmacy.in/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);
  await page.mouse.move(WIDTH / 2, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1000);
  const out = await page.evaluate(() => {
    const T = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
    const CL = (e) => (e.className || "").toString().replace(/\s+/g, " ").trim();
    const st = [...document.querySelectorAll("body *")]
      .filter((e) => getComputedStyle(e).position === "sticky")
      .map((e) => {
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return { cls: CL(e).slice(0, 55), top: cs.top, y: Math.round(r.top), h: Math.round(r.height), text: T(e).slice(0, 50) };
      });
    return { scrollY: Math.round(window.scrollY), st };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
