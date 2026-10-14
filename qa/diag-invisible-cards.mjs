import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "dist-verify");

async function serve(page) {
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "kc.local") return r.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html"))
      return r.fulfill({ status: 200, contentType: "text/html", body: fs.readFileSync(path.join(ROOT, "index.html")) });
    const f = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ""));
    if (f.startsWith(ROOT) && fs.existsSync(f)) {
      const ext = path.extname(f);
      const t = ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : "application/octet-stream";
      return r.fulfill({ status: 200, contentType: t, body: fs.readFileSync(f) });
    }
    return r.fulfill({ status: 404, body: "" });
  });
}

const MEASURE = () => {
  const out = [];
  for (const card of document.querySelectorAll('[data-slot="card"]')) {
    const wrapper = card.parentElement;
    const ws = getComputedStyle(wrapper);
    const name = card.querySelector("h3")?.textContent?.trim().slice(0, 26);
    const section = card.closest("section")?.querySelector("h2")?.textContent?.trim().slice(0, 24);
    out.push({
      section,
      name,
      wrapperTag: wrapper.tagName,
      wrapperOpacity: ws.opacity,
      wrapperTransform: ws.transform,
      wrapperVisibility: ws.visibility,
      cardOpacity: getComputedStyle(card).opacity,
      imgOpacity: card.querySelector("img") ? getComputedStyle(card.querySelector("img")).opacity : "no-img",
    });
    if (out.length >= 6) break;
  }
  return out;
};

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  for (const [label, vp] of [["mobile-390", { width: 390, height: 844 }], ["desktop-1280", { width: 1280, height: 900 }]]) {
    const page = await browser.newPage();
    await page.setViewportSize(vp);
    await serve(page);
    await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(6000);
    console.log(`\n=== ${label}: BEFORE click ===`);
    console.log(JSON.stringify(await page.evaluate(MEASURE), null, 1));

    // Click the first invisible card's blank area
    const clicked = await page.evaluate(() => {
      const card = document.querySelector('[data-slot="card"]');
      const w = card.parentElement;
      const r = w.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      el?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      return { hit: el?.className?.toString?.().slice(0, 60) || el?.tagName };
    });
    await page.waitForTimeout(1200);
    console.log(`clicked hit: ${JSON.stringify(clicked)}`);
    console.log(`=== ${label}: AFTER click ===`);
    console.log(JSON.stringify(await page.evaluate(MEASURE), null, 1));
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
