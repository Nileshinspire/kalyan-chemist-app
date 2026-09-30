// Probe v4: catch EVERY scroll mechanism — window.scroll/scrollBy/scrollTo,
// scrollIntoView, scrollTop/scrollLeft setters on any element, and focus().
import { chromium } from "playwright";

const BASE = "https://sunny-baths-help.freebuff.dev";
const slug = process.argv[2] || "volini-gel";
const from = process.argv[3] || "/products";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  window.__log = [];
  const stamp = (kind, extra, stack) => {
    window.__log.push({
      kind, ...extra,
      y: Math.round(window.scrollY),
      docH: document.documentElement.scrollHeight,
      stack: (stack || "").split("\n").slice(2, 6).map((s) => s.trim().slice(0, 130)).join(" | "),
    });
  };
  for (const name of ["scrollTo", "scroll", "scrollBy"]) {
    const orig = window[name].bind(window);
    window[name] = function (...args) { stamp("window." + name, { args: JSON.stringify(args).slice(0, 100) }, new Error().stack); return orig(...args); };
  }
  const oSIV = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...args) { stamp("scrollIntoView", { tag: this.tagName, cls: String(this.className).slice(0, 50) }, new Error().stack); return oSIV.apply(this, args); };
  for (const proto of [Element.prototype, HTMLElement.prototype]) {
    const d = Object.getOwnPropertyDescriptor(proto, "scrollTop");
    if (d && d.set) {
      Object.defineProperty(proto, "scrollTop", {
        get: d.get,
        set(v) { stamp("scrollTop=", { tag: this.tagName, cls: String(this.className).slice(0, 40), v: String(v) }, new Error().stack); d.set.call(this, v); },
        configurable: true,
      });
    }
  }
  const oFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (...args) { stamp("focus()", { tag: this.tagName, cls: String(this.className).slice(0, 50) }, new Error().stack); return oFocus.apply(this, args); };
  window.addEventListener("scroll", (e) => {
    stamp("scroll-event", { target: e.target === document ? "document" : e.target.tagName }, "");
  }, true);

  window.__samples = [];
  let started = false;
  window.__startSampling = () => { started = true; };
  const tick = () => {
    if (started) {
      window.__samples.push({ t: performance.now() | 0, y: Math.round(window.scrollY), docH: document.documentElement.scrollHeight, hash: location.hash.slice(-22) });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

await page.goto(`${BASE}/#${from}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(800);
await page.evaluate(() => { window.__log.length = 0; window.__startSampling(); });
await page.getByRole("heading", { name: /volini/i }).first().click({ timeout: 5000 });
await page.waitForTimeout(2200);

const { log, samples } = await page.evaluate(() => ({ log: window.__log, samples: window.__samples }));
console.log("EVENT LOG:");
for (const l of log) console.log(JSON.stringify(l));
console.log("\nY CURVE (changes only):");
let prev = "";
for (const s of samples) {
  const k = `${s.y}/${s.docH}/${s.hash}`;
  if (k !== prev) { console.log(JSON.stringify(s)); prev = k; }
}
await browser.close();
