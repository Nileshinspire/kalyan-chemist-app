// Baseline audit: homepage section heights @375, header stack, floats, overflow + screenshots.
// Usage: node qa/diag-mobile-audit.mjs
import { launch, go, report, assertPreview, BASE } from "./harness.mjs";
import { anonymousSignIn, injectSession } from "./authSession.mjs";

const errors = [];
const ok = (cond, msg) => (cond ? { ok: true, msg } : (errors.push(msg), { ok: false, msg }));

const { browser, page } = await launch({ mobile: true });
await assertPreview();

// session (auth-gated nav later); ignore failure
try {
  const s = await anonymousSignIn();
  for (let i = 0; i < 3; i++) { try { await injectSession(page, s); break; } catch { await page.waitForTimeout(900); } }
} catch {}

await page.setViewportSize({ width: 375, height: 844 });
await go(page, "#/");
await page.waitForTimeout(2500);

// ── horizontal overflow @375
const ov375 = await page.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  iw: window.innerWidth,
}));
ok(ov375.sw <= ov375.iw + 1, `overflow@375 sw=${ov375.sw} iw=${ov375.iw}`);

// ── section heights on homepage
const sections = await page.evaluate(() => {
  const root = document.querySelector("#root") || document.body;
  const out = [];
  const walk = (el) => {
    for (const c of el.children) {
      if (c.tagName === "SECTION" || c.tagName === "FOOTER" || c.tagName === "HEADER") {
        const r = c.getBoundingClientRect();
        const h2 = c.querySelector("h1,h2");
        out.push({ tag: c.tagName, head: (h2?.textContent || "").trim().slice(0, 44), h: Math.round(r.height) });
      } else walk(c);
    }
  };
  walk(root);
  return out;
});

// ── header stack height (homepage vs inner page)
const headerHome = await page.evaluate(() => Math.round(document.querySelector("header")?.getBoundingClientRect().height || 0));
await go(page, "#/products");
await page.waitForTimeout(1200);
const headerInner = await page.evaluate(() => Math.round(document.querySelector("header")?.getBoundingClientRect().height || 0));

// ── floats: bounding boxes + overlap + safe margins
const floats = await page.evaluate(() => {
  const grab = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) };
  };
  // find fixed elements bottom-right
  const fixed = [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).position === "fixed");
  const boxes = fixed.map((e) => {
    const r = e.getBoundingClientRect();
    return { cls: (e.className || "").toString().slice(0, 60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  }).filter((b) => b.w > 20 && b.h > 20);
  return { boxes, iw: window.innerWidth, ih: window.innerHeight };
});

// ── screenshots
const SUF = process.env.SHOT_SUFFIX || "before";
await go(page, "#/");
await page.waitForTimeout(2000);
await page.screenshot({ path: `qa/shots/home-375-${SUF}.png`, fullPage: true });
await page.setViewportSize({ width: 320, height: 800 });
await page.waitForTimeout(800);
const ov320 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
ok(ov320.sw <= ov320.iw + 1, `overflow@320 sw=${ov320.sw} iw=${ov320.iw}`);
await page.screenshot({ path: `qa/shots/home-320-${SUF}.png`, fullPage: true });
await page.setViewportSize({ width: 430, height: 900 });
await page.waitForTimeout(800);
await page.screenshot({ path: `qa/shots/home-430-${SUF}.png`, fullPage: true });

console.log(JSON.stringify({ sections, headerHome, headerInner, floats, ov375, ov320 }, null, 1));
report(errors, "mobile-audit");
process.exit(errors.length ? 1 : 0);
