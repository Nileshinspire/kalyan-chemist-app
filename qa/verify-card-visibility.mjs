import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "dist-verify");
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failures++;
};

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

const PROBE = () => {
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) < 0.99) return false;
      n = n.parentElement;
    }
    return true;
  };

  const results = [];
  for (const card of document.querySelectorAll('[data-slot="card"]')) {
    const name = card.querySelector("h3");
    const price = [...card.querySelectorAll("span")].find((s) => /₹/.test(s.textContent || ""));
    const img = card.querySelector("img");
    const buttons = [...card.querySelectorAll("button")].filter((b) =>
      /buy now|cart|out of stock/i.test(b.textContent || "")
    );
    const wrapper = card.parentElement;
    results.push({
      name: name?.textContent?.trim().slice(0, 26) || "(no name)",
      wrapperOpacity: getComputedStyle(wrapper).opacity,
      nameVisible: isVisible(name),
      imgVisible: img ? isVisible(img) : "placeholder",
      priceVisible: isVisible(price),
      buttonsVisible: buttons.length > 0 && buttons.every(isVisible),
      buttonCount: buttons.length,
      cardVisible: isVisible(card),
    });
  }
  return results;
};

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const pages = [
    ["home", "#/"],
    ["products listing", "#/products"],
    ["value deals page", "#/value-deals"],
    ["hot sellers page", "#/hot-sellers"],
  ];

  for (const [label, vp] of [["mobile-390", { width: 390, height: 844 }], ["desktop-1280", { width: 1280, height: 900 }]]) {
    for (const [pageName, hash] of pages) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
      await page.setViewportSize(vp);
      await serve(page);
      await page.goto(`http://kc.local/${hash}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000);

      const cards = await page.evaluate(PROBE);
      const tag = `${label} / ${pageName}`;

      if (pageName === "home" || pageName === "products listing") {
        check(`${tag}: product cards found`, cards.length > 0, `count=${cards.length}`);
      }
      if (cards.length === 0) {
        console.log(`   (no product cards on ${pageName})`);
      } else {
        check(`${tag}: every card wrapper is opaque on load`, cards.every((c) => c.wrapperOpacity === "1"), JSON.stringify([...new Set(cards.map((c) => c.wrapperOpacity))]));
        check(`${tag}: every card is visible on load`, cards.every((c) => c.cardVisible), JSON.stringify(cards.filter((c) => !c.cardVisible).map((c) => c.name)));
        check(`${tag}: every product name is visible`, cards.every((c) => c.nameVisible), JSON.stringify(cards.filter((c) => !c.nameVisible).map((c) => c.name)));
        check(`${tag}: every product image is visible`, cards.every((c) => c.imgVisible === true || c.imgVisible === "placeholder"), JSON.stringify(cards.filter((c) => c.imgVisible === false).map((c) => c.name)));
        check(`${tag}: every price is visible`, cards.every((c) => c.priceVisible), JSON.stringify(cards.filter((c) => !c.priceVisible).map((c) => c.name)));
        check(`${tag}: every action button pair is visible`, cards.every((c) => c.buttonsVisible), JSON.stringify(cards.filter((c) => !c.buttonsVisible).map((c) => c.name)));
        console.log(`   cards=${cards.length} sample=${JSON.stringify(cards.slice(0, 2))}`);
      }
      check(`${tag}: no page errors`, errors.length === 0, JSON.stringify(errors));

      // Clicking a card must still open its product page.
      if (pageName === "home" && cards.length > 0) {
        await page.evaluate(() => {
          const card = document.querySelector('[data-slot="card"]');
          card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        await page.waitForTimeout(1500);
        const hashNow = await page.evaluate(() => location.hash);
        check(`${tag}: clicking a card opens its product page`, /\/products\//.test(hashNow), hashNow);
      }
      await page.close();
    }
  }

  await browser.close();
  console.log(failures === 0 ? "\nALL VISIBILITY CHECKS PASSED" : `\n${failures} VISIBILITY CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
