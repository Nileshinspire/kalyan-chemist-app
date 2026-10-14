import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "dist-verify");

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "kc.local") return r.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html"))
      return r.fulfill({ status: 200, contentType: "text/html", body: fs.readFileSync(path.join(ROOT, "index.html")) });
    const file = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ""));
    if (file.startsWith(ROOT) && fs.existsSync(file)) {
      const ext = path.extname(file);
      const t = ext === ".js" ? "text/javascript" : ext === ".css" ? "text/css" : "application/octet-stream";
      return r.fulfill({ status: 200, contentType: t, body: fs.readFileSync(file) });
    }
    return r.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.9);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 1400));
  });

  const info = await page.evaluate(() => {
    const sec = [...document.querySelectorAll("section")].find((s) =>
      (s.querySelector("h2")?.textContent || "").includes("New Arrivals")
    );
    const cards = [...sec.querySelectorAll(".kc-new-arrival")];
    return cards.map((wrap) => {
      const card = wrap.querySelector('[data-slot="card"]');
      const img = card.querySelector("img");
      const name = card.querySelector("h3")?.textContent?.trim().slice(0, 34);
      const r = img.getBoundingClientRect();
      return {
        name,
        src: (img.getAttribute("src") || "").slice(-24),
        natural: `${img.naturalWidth}x${img.naturalHeight}`,
        rendered: `${Math.round(r.width)}x${Math.round(r.height)}`,
        inline: img.getAttribute("style") || "(none)",
        cls: img.className,
        complete: img.complete,
      };
    });
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
