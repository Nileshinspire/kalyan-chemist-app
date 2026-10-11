import { chromium } from "playwright-core";

const URLS = ["https://www.apollopharmacy.in/"];

async function probe(browser, width, isMobile) {
  const ctx = await browser.newContext({
    viewport: { width, height: isMobile ? 844 : 900 },
    isMobile,
    hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
    userAgent: isMobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  const page = await ctx.newPage();
  const out = { width, ok: false };
  try {
    await page.goto(URLS[0], { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(6000);
    out.title = await page.title();
    out.metrics = await page.evaluate(() => {
      const de = document.documentElement;
      const res = {
        vw: de.clientWidth,
        scrollWidth: de.scrollWidth,
        overflow: de.scrollWidth > de.clientWidth + 1,
        bodyH: Math.round(document.body.scrollHeight),
      };
      // header
      const hdr = document.querySelector("header") || document.body.firstElementChild;
      if (hdr) {
        const r = hdr.getBoundingClientRect();
        res.header = { tag: hdr.tagName, h: Math.round(r.height), pos: getComputedStyle(hdr).position, text: (hdr.innerText || "").replace(/\s+/g, " ").slice(0, 160) };
      }
      // fixed/sticky elements
      res.fixed = [];
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 30 || r.height < 20) continue;
        res.fixed.push({ pos: cs.position, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), cls: String(el.className || "").slice(0, 60), text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 50) });
        if (res.fixed.length > 12) break;
      }
      // grid columns (count distinct column tracks of elements that look like grids)
      res.grids = [];
      for (const el of document.querySelectorAll("div,ul")) {
        const cs = getComputedStyle(el);
        if (!cs.display.includes("grid")) continue;
        const n = cs.gridTemplateColumns.split(" ").filter(Boolean).length;
        if (n < 2) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 200) continue;
        res.grids.push({ cols: n, w: Math.round(r.width), cls: String(el.className || "").slice(0, 50) });
        if (res.grids.length > 10) break;
      }
      // horizontal scrollers (carousels)
      res.scrollers = [];
      for (const el of document.querySelectorAll("div,ul")) {
        if (el.scrollWidth > el.clientWidth + 40 && el.clientWidth > 150 && el.clientHeight > 60) {
          const r = el.getBoundingClientRect();
          res.scrollers.push({ cw: Math.round(el.clientWidth), sw: Math.round(el.scrollWidth), h: Math.round(r.height), cls: String(el.className || "").slice(0, 50) });
          if (res.scrollers.length > 8) break;
        }
      }
      // images with aspect
      res.imgs = [];
      for (const img of document.querySelectorAll("img")) {
        const r = img.getBoundingClientRect();
        if (r.width < 40 || r.height < 30) continue;
        res.imgs.push({ w: Math.round(r.width), h: Math.round(r.height), ar: +(r.width / r.height).toFixed(2) });
        if (res.imgs.length > 10) break;
      }
      // top-level sections in order
      res.sections = [];
      const isSect = (t) => /^(SECTION|FOOTER|HEADER)$/.test(t);
      const walk = (el, depth) => {
        for (const c of el.children) {
          if (isSect(c.tagName)) {
            const r = c.getBoundingClientRect();
            if (r.height < 60) continue;
            const h = c.querySelector("h1,h2,h3");
            res.sections.push({ tag: c.tagName, h: Math.round(r.height), head: h ? (h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) : (c.innerText || "").replace(/\s+/g, " ").slice(0, 40) });
          } else if (depth < 6) walk(c, depth + 1);
        }
      };
      walk(document.body, 0);
      res.sections = res.sections.slice(0, 30);
      return res;
    });
    out.ok = true;
  } catch (e) {
    out.error = String(e).slice(0, 300);
  }
  await ctx.close();
  return out;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [w, m] of [[1440, false], [390, true], [320, true]]) {
  const r = await probe(browser, w, m);
  console.log("\n########## APOLLO w=" + w + (m ? " MOBILE" : " DESKTOP") + " ok=" + r.ok);
  console.log(JSON.stringify(r, null, 1));
}
await browser.close();
