// Verify the mobile product-card image sizing / proportions fix.
// Usage: node qa/verify-mobile-card-proportions.mjs
//
// Checks, at 360/375/390/430px:
//  - every product image is contained (never cropped) and fully inside its band
//  - the rendered product keeps its natural aspect ratio (contain, no stretch)
//  - there is white space between the image and the band on every side
//  - cards inside one carousel/grid share a single width
//  - name, price and both action buttons are visible on load
//  - tapping a card still opens the product route
//  - no page-level horizontal overflow
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = join(process.cwd(), process.env.KC_ROOT || "dist-verify");
const SHOTS = join(process.cwd(), "qa/shots");
mkdirSync(SHOTS, { recursive: true });
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

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
      return r.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(ROOT, "index.html")) });
    const f = join(ROOT, normalize(p).replace(/^([/\\])+/, ""));
    if (f.startsWith(ROOT) && existsSync(f) && statSync(f).isFile())
      return r.fulfill({ status: 200, contentType: MIME[extname(f)] || "application/octet-stream", body: readFileSync(f) });
    return r.fulfill({ status: 404, body: "" });
  });
}

const PROBE = () => {
  const isVisible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.9 && r.width > 4 && r.height > 4;
  };
  const cards = [...document.querySelectorAll('[data-slot="card"]')].filter((c) =>
    /buy now|cart|out of stock/i.test(c.textContent || "")
  );
  const out = [];
  for (const card of cards) {
    const wrapper = card.parentElement;
    const band =
      card.querySelector('div[class*="aspect-square"]') ||
      card.querySelector('div[class*="h-24"], div[class*="h-44"]');
    const img = card.querySelector("img");
    const buttons = [...card.querySelectorAll("button")];
    if (!band) continue;
    const br = band.getBoundingClientRect();
    let imgInfo = null;
    if (img) {
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      const natAspect = img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
      const renAspect = r.height > 0 ? r.width / r.height : null;
      // Actual drawn (letterboxed) size of an `object-fit: contain` image.
      const nW = img.naturalWidth || 0;
      const nH = img.naturalHeight || 0;
      const scale = nW && nH ? Math.min(r.width / nW, r.height / nH) : 0;
      const drawnW = Math.round(nW * scale);
      const drawnH = Math.round(nH * scale);
      imgInfo = {
        fit: cs.objectFit,
        w: Math.round(r.width),
        h: Math.round(r.height),
        drawnW,
        drawnH,
        drawnAspect: drawnH ? +(drawnW / drawnH).toFixed(3) : null,
        natAspect: natAspect === null ? null : +natAspect.toFixed(3),
        renAspect: renAspect === null ? null : +renAspect.toFixed(3),
        gapLeft: Math.round(r.left - br.left),
        gapRight: Math.round(br.right - r.right),
        gapTop: Math.round(r.top - br.top),
        gapBottom: Math.round(br.bottom - r.bottom),
        inside: r.left >= br.left - 1 && r.right <= br.right + 1 && r.top >= br.top - 1 && r.bottom <= br.bottom + 1,
        visible: isVisible(img),
      };
    }
    // Leaf boxes used for the "nothing collides" check.
    const r2 = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) };
    };
    const priceEl = [...card.querySelectorAll("span")].find((s) => /₹/.test(s.textContent || ""));
    const actionRow = buttons[buttons.length - 1]?.parentElement;
    const boxes = [
      { label: "name", box: r2(card.querySelector("h3")) },
      { label: "manufacturer", box: r2(card.querySelector("h3 + p")) },
      { label: "price", box: r2(priceEl) },
      { label: "actions", box: r2(actionRow) },
    ].filter((x) => x.box);
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].box, b = boxes[j].box;
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ox > 2 && oy > 2) overlaps.push(`${boxes[i].label}/${boxes[j].label} ${ox}x${oy}`);
      }

    const section = card.closest("section");
    const head = section?.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 28) || "?";
    out.push({
      head,
      name: (card.querySelector("h3")?.textContent || "").trim().slice(0, 24),
      cardW: Math.round(wrapper.getBoundingClientRect().width),
      wrapperOpacity: getComputedStyle(wrapper).opacity,
      cardOpacity: getComputedStyle(card).opacity,
      bandW: Math.round(br.width),
      bandH: Math.round(br.height),
      img: imgInfo,
      nameVisible: isVisible(card.querySelector("h3")),
      priceVisible: isVisible(card.querySelector("span")),
      buttons: buttons.map((b) => ({ l: (b.textContent || "").trim().slice(0, 10), h: Math.round(b.getBoundingClientRect().height), v: isVisible(b) })),
      overlaps,
      overflowInside: card.scrollWidth > card.clientWidth + 2,
      href: card.querySelector("a")?.getAttribute("href") || null,
      slug: null,
    });
  }
  return { vw: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth, cards: out };
};

const routes = [
  ["home", "#/", "/#/products/"],
  ["products", "#/products", "/#/products/"],
  ["hot-sellers", "#/hot-sellers", "/#/products/"],
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const w of [360, 375, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await serve(page);

  for (const [label, route] of routes) {
    await page.goto(`http://kc.local/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2600);
    await page.evaluate(async () => {
      const step = Math.round(innerHeight * 0.9);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 70));
      }
      scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 500));
    });

    const data = await page.evaluate(PROBE);
    const tag = `${w} ${label}`;

    check(`${tag}: no horizontal page overflow`, data.scrollW <= data.vw + 1, `scrollW=${data.scrollW} vw=${data.vw}`);
    check(`${tag}: product cards found`, data.cards.length > 0, `n=${data.cards.length}`);

    // visible on load
    const invisible = data.cards.filter(
      (c) => c.cardOpacity !== "1" || c.wrapperOpacity !== "1" || !c.nameVisible || !c.priceVisible || !c.buttons.some((b) => /buy now|out of stock/i.test(b.l) && b.v) || !c.buttons.some((b) => /cart/i.test(b.l) && b.v)
    );
    check(`${tag}: every card visible on load (name, price, both buttons)`, invisible.length === 0, JSON.stringify(invisible.slice(0, 2)));

    // image checks (only cards with a real image)
    const withImg = data.cards.filter((c) => c.img && c.img.visible);
    const cropped = withImg.filter((c) => c.img.fit !== "contain");
    check(`${tag}: every product image is object-fit: contain (no crop)`, cropped.length === 0, JSON.stringify(cropped.slice(0, 2).map((c) => c.name + ":" + c.img.fit)));

    const outside = withImg.filter((c) => !c.img.inside);
    check(`${tag}: every image stays inside its band`, outside.length === 0, JSON.stringify(outside.slice(0, 2)));

    // With `object-fit: contain` the drawn (letterboxed) product must keep the
    // source aspect ratio — that is how "no stretch" is observable in the DOM.
    const stretched = withImg.filter((c) => c.img.drawnAspect && Math.abs(c.img.natAspect - c.img.drawnAspect) > 0.03);
    check(`${tag}: drawn image keeps its natural aspect ratio (not stretched)`, stretched.length === 0, JSON.stringify(stretched.slice(0, 3).map((c) => `${c.name} nat=${c.img.natAspect} drawn=${c.img.drawnAspect}`)));

    // The visible product must not fill the whole band: there has to be real
    // white space around it (the whole point of the Apollo-style treatment).
    const oversized = withImg.filter((c) => c.img.drawnW > c.bandW * 0.93 || c.img.drawnH > c.bandH * 0.93);
    check(`${tag}: drawn product is smaller than its band (>=7% white space)`, oversized.length === 0, JSON.stringify(oversized.slice(0, 3).map((c) => `${c.name} drawn=${c.img.drawnW}x${c.img.drawnH} band=${c.bandW}x${c.bandH}`)));

    const tight = withImg.filter((c) => Math.min(c.img.gapLeft, c.img.gapRight, c.img.gapTop, c.img.gapBottom) < 4);
    check(`${tag}: white space around every product image (>=4px)`, tight.length === 0, JSON.stringify(tight.slice(0, 3).map((c) => `${c.name} ${c.img.gapLeft}/${c.img.gapRight}/${c.img.gapTop}/${c.img.gapBottom}`)));

    const bandNotSquare = data.cards.filter((c) => Math.abs(c.bandW - c.bandH) > 2);
    check(`${tag}: image band is square`, bandNotSquare.length === 0, JSON.stringify(bandNotSquare.slice(0, 2).map((c) => c.bandW + "x" + c.bandH)));

    // consistent width per section
    const groups = new Map();
    for (const c of data.cards) groups.set(c.head, [...(groups.get(c.head) || []), c.cardW]);
    const ragged = [...groups.entries()].filter(([, ws]) => new Set(ws).size > 1);
    check(`${tag}: cards in the same section share one width`, ragged.length === 0, JSON.stringify(ragged));

    check(`${tag}: no card content overflow`, data.cards.every((c) => !c.overflowInside));

    const colliding = data.cards.filter((c) => c.overlaps.length > 0);
    check(`${tag}: name/manufacturer/price/buttons never collide`, colliding.length === 0, JSON.stringify(colliding.slice(0, 3).map((c) => `${c.name}: ${c.overlaps.join(",")}`)));

    // images never larger than the band
    const tooBig = withImg.filter((c) => c.img.w > c.bandW + 1 || c.img.h > c.bandH + 1);
    check(`${tag}: no image larger than its band`, tooBig.length === 0, JSON.stringify(tooBig.slice(0, 2)));

    check(`${tag}: no page errors`, errors.length === 0, JSON.stringify(errors.slice(0, 2)));

    const names = withImg.map((c) => `${c.name}: drawn ${c.img.drawnW}x${c.img.drawnH} (nat ${c.img.natAspect}) in band ${c.bandW}x${c.bandH}, card ${c.cardW}`);
    console.log("   " + names.slice(0, 5).join("\n   "));
    if (label === "home") await page.screenshot({ path: join(SHOTS, `mobileproportions-${w}.png`) });
  }

  // tapping a card still navigates
  await page.goto("http://kc.local/#/products", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2600);
  const before = page.url();
  const clicked = await page.evaluate(() => {
    const card = [...document.querySelectorAll('[data-slot="card"]')].find((c) => /buy now/i.test(c.textContent || ""));
    if (!card) return null;
    card.querySelector("h3")?.click();
    return (card.querySelector("h3")?.textContent || "").trim();
  });
  await page.waitForTimeout(1800);
  const after = page.url();
  check(`${w}: tapping a card opens the product route`, clicked !== null && /#\/products\/.+/.test(after) && after !== before, `${clicked} -> ${after}`);
  await ctx.close();
}
await browser.close();
console.log(failures === 0 ? "\nALL MOBILE CARD PROPORTION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
