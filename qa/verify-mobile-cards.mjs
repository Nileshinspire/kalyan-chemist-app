/*
 * Verifies the shared ProductCard image framing on a phone viewport against a
 * built bundle, using Playwright route interception to serve dist-verify.
 *
 * For each card in the Value Deals / New Arrivals sections it records:
 *   - the image band's rendered height (must be a fixed, small value)
 *   - the <img>'s rendered box (must stay inside the band)
 *   - the card's outer height (must match its siblings' grid-track height)
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "dist-verify");

async function serveAndOpen(page, viewport) {
  await page.setViewportSize(viewport);
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "kc.local") return route.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html"))
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: fs.readFileSync(path.join(ROOT, "index.html")),
      });
    const file = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ""));
    if (file.startsWith(ROOT) && fs.existsSync(file)) {
      const ext = path.extname(file);
      const type =
        ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : "application/octet-stream";
      return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
}

const MEASURE = ({ sectionTitle, gridSelector }) => {
  const section = [...document.querySelectorAll("section")].find((s) =>
    (s.querySelector("h2")?.textContent || "").includes(sectionTitle)
  );
  if (!section) return { found: false };
  const cards = [...section.querySelectorAll(gridSelector)];
  return {
    found: true,
    count: cards.length,
    cards: cards.map((wrap) => {
      const card = wrap.querySelector('[data-slot="card"]') || wrap;
      const band = card.querySelector("div.relative.flex");
      const img = card.querySelector("img");
      const br = band?.getBoundingClientRect();
      const ir = img?.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      return {
        cardH: Math.round(cr.height),
        bandH: br ? Math.round(br.height) : null,
        bandW: br ? Math.round(br.width) : null,
        imgW: ir ? Math.round(ir.width) : null,
        imgH: ir ? Math.round(ir.height) : null,
        imgOverflowsBand: br && ir ? ir.height > br.height + 1 || ir.width > br.width + 1 : null,
        loaded: img ? img.complete && img.naturalWidth > 0 : null,
      };
    }),
  };
};

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });

  for (const [label, viewport] of [
    ["mobile-375", { width: 375, height: 844 }],
    ["desktop-1280", { width: 1280, height: 900 }],
  ]) {
    const page = await browser.newPage();
    await serveAndOpen(page, viewport);
    const deals = await page.evaluate(MEASURE, {
      sectionTitle: "Value Deals Under",
      gridSelector: ".kc-value-deal",
    });
    const arrivals = await page.evaluate(MEASURE, {
      sectionTitle: "New Arrivals",
      gridSelector: ".kc-new-arrival",
    });
    console.log(`\n=== ${label} ===`);
    console.log("Value Deals:", JSON.stringify(deals));
    console.log("New Arrivals:", JSON.stringify(arrivals));
    await page.close();
  }

  await browser.close();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
