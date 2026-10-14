// Verify the mobile product-detail fixes:
//   1. Fast Delivery / Secure Packaging / Trusted Pharmacy in ONE aligned row
//   2. the nine Product Information tabs in balanced rows
//   3. fixed purchase bar / bottom nav / chatbot float don't overlap or hide content
//   4. no horizontal overflow at 320/360/375/390/430
// and that the desktop (1440) product page is unchanged.
//
// Usage: node qa/detail-mobile-fix.mjs            (baseline: dist  vs dist-verify)
//        KC_ONLY=new node qa/detail-mobile-fix.mjs
//
// The public preview is not always reachable, so everything is measured from a
// local build of the current source (`dist-verify`) served through Playwright
// route interception; the last shipped bundle (`dist`) is measured the same way
// for the desktop before/after comparison.
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const OLD = join(process.cwd(), process.env.KC_OLD_ROOT || "dist");
const NEW = join(process.cwd(), process.env.KC_NEW_ROOT || "dist-verify");
const ROOTS = process.env.KC_ONLY === "new" ? [["new", NEW]] : [["new", NEW], ["before", OLD]];
const SHOTS = join(process.cwd(), "qa/shots");
mkdirSync(SHOTS, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} :: ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failures++;
};

async function serveFrom(page, root) {
  await page.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== "kc.local") return r.continue();
    const p = decodeURIComponent(u.pathname);
    if (p === "/" || p.endsWith(".html")) {
      return r.fulfill({ status: 200, contentType: MIME[".html"], body: readFileSync(join(root, "index.html")) });
    }
    const file = join(root, normalize(p).replace(/^([/\\])+/, ""));
    if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) {
      return r.fulfill({ status: 200, contentType: MIME[extname(file)] || "application/octet-stream", body: readFileSync(file) });
    }
    return r.fulfill({ status: 404, body: "" });
  });
}

/** Runs in the page: measure the delivery feature strip, the tab bar and fixed chrome. */
const PROBE = () => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
      bottom: Math.round(r.bottom + window.scrollY),
    };
  };
  const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  // Text of an element as the USER sees it: hidden responsive twins excluded.
  const visText = (el) =>
    [...el.querySelectorAll("span")]
      .filter((s) => s.offsetParent !== null && text(s))
      .map((s) => text(s))
      .join(" ")
      .trim();

  // ── 1. delivery feature strip ────────────────────────────────────────────
  // The header also shows trust wording, so pick the group of spans that holds
  // the most of these three labels, breaking ties by the lowest (later) group —
  // that is the product panel's strip.
  const FEATURES = ["Fast Delivery", "Secure Packaging", "Trusted Pharmacy"];
  const groups = new Map();
  for (const s of [...document.querySelectorAll("span")]) {
    const t = text(s);
    if (!FEATURES.includes(t) || s.offsetParent === null) continue;
    // the three labels sit in their own item div, so group by the strip above them
    const p = s.parentElement?.parentElement;
    if (!p) continue;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(s);
  }
  const best = [...groups.entries()]
    // the product panel's strip lives inside <main>; the header/footer copies don't
    .filter(([parent]) => parent.closest("main"))
    .map(([parent, spans]) => ({ parent, spans, y: Math.round(parent.getBoundingClientRect().top + window.scrollY) }))
    .sort((a, b) => b.spans.length - a.spans.length || a.y - b.y)[0];
  const featureItems = [];
  for (const name of FEATURES) {
    const heading = best?.spans.find((s) => text(s) === name);
    if (!heading) continue;
    const item = heading.closest("div");
    const icon = item?.querySelector("svg");
    const desc = [...(item?.querySelectorAll("span") || [])].find((s) => s !== heading && text(s) && s.offsetParent !== null);
    featureItems.push({
      name,
      item: box(item),
      icon: box(icon),
      heading: box(heading),
      desc: box(desc),
      descText: text(desc),
      parent: item ? { cls: String(item.parentElement.className).slice(0, 120), display: getComputedStyle(item.parentElement).display, cols: getComputedStyle(item.parentElement).gridTemplateColumns, gap: getComputedStyle(item.parentElement).gap, box: box(item.parentElement) } : null,
    });
  }
  // the strip the three items lay out in (grid on phones, flex row from `sm`)
  const p0 = featureItems[0]?.parent;
  const strip = p0 ? { ...p0.box, display: p0.display, cols: p0.cols, gap: p0.gap } : null;
  const features = { items: featureItems, strip };

  // ── 2. tab bar ──────────────────────────────────────────────────────────
  const TAB_LABELS = ["Product", "Medical", "Key", "Directions", "Safety", "Information", "FAQs", "Customers", "Other"];
  // Phones show the short label, `sm`+ the full one; both map to one tab.
  const FULL_TO_SHORT = {
    "Product Information": "Product",
    "Medical Benefits": "Medical",
    "Key Ingredients": "Key",
    "Directions for Use": "Directions",
    "Customers Also Bought": "Customers",
    "Other Links": "Other",
  };
  const labelOf = (b) => {
    const t = visText(b);
    return TAB_LABELS.includes(t) ? t : FULL_TO_SHORT[t] || null;
  };
  const tabButtons = [...document.querySelectorAll("button")].filter((b) => labelOf(b));
  const tabs = tabButtons.map((b) => {
    const label = [...b.querySelectorAll("span")].find((s) => text(s) && !s.className.includes("absolute") && s.offsetParent !== null);
    const icon = b.querySelector("svg");
    const cs = label ? getComputedStyle(label) : null;
    return {
      label: labelOf(b),
      shown: visText(b),
      box: box(b),
      icon: box(icon),
      labelBox: box(label),
      labelClipped: label ? label.scrollWidth > label.clientWidth + 1 : null,
      fontSize: cs ? Math.round(parseFloat(cs.fontSize)) : null,
      active: getComputedStyle(b).color,
    };
  });
  const rows = {};
  for (const t of tabs) {
    const key = t.box.y;
    (rows[key] = rows[key] || []).push(t.label);
  }
  const tabRows = Object.entries(rows)
    .sort((a, b) => a[0] - b[0])
    .map(([y, labels]) => ({ y: Number(y), labels }));
  const tabBar = tabs.length ? tabs[0].box && (() => {
    let el = tabButtons[0].parentElement;
    while (el && !(el.className || "").toString().match(/rounded-2xl/)) el = el.parentElement;
    return box(el);
  })() : null;
  // the container the tabs lay out in (the phones grid, or the desktop row)
  const tabGridEl = tabButtons[0]?.closest('[class*="grid-cols-3"]');
  const tabGrid = tabGridEl && tabGridEl.offsetParent !== null
    ? { display: getComputedStyle(tabGridEl).display, cols: getComputedStyle(tabGridEl).gridTemplateColumns, gap: getComputedStyle(tabGridEl).gap, box: box(tabGridEl) }
    : null;

  // ── 3. fixed chrome ─────────────────────────────────────────────────────
  const fixed = [...document.querySelectorAll("body *")]
    .filter((e) => getComputedStyle(e).position === "fixed")
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { cls: String(e.className || "").slice(0, 70), txt: text(e).slice(0, 30), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    })
    .filter((b) => b.w > 24 && b.h > 24);
  const overlaps = [];
  for (let i = 0; i < fixed.length; i++) {
    for (let j = i + 1; j < fixed.length; j++) {
      const a = fixed[i], b = fixed[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) overlaps.push({ a: a.cls.slice(0, 30) || a.txt, b: b.cls.slice(0, 30) || b.txt, ox, oy });
    }
  }

  return {
    vw: document.documentElement.clientWidth,
    scrollW: document.documentElement.scrollWidth,
    features,
    tabs,
    tabRows,
    tabBar,
    tabGrid,
    fixed,
    overlaps,
  };
};

// Bottom clearance: scroll to the very end and see if the last content is hidden
// behind the fixed purchase bar / bottom nav.
const BOTTOM_PROBE = () => {
  window.scrollTo(0, document.body.scrollHeight);
  // Only the full-width fixed bars (mobile bottom nav + sticky purchase bar)
  // matter for "is content hidden"; a small floating button does not.
  const bars = [...document.querySelectorAll("body *")]
    .filter((e) => getComputedStyle(e).position === "fixed")
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.height > 24 && r.width > window.innerWidth * 0.6 && r.top > window.innerHeight * 0.4)
    .map((r) => Math.round(r.top));
  const fixedTop = bars.length ? Math.min(...bars) : window.innerHeight;
  const footer = document.querySelector("footer");
  const lastTextEl = footer
    ? [...footer.querySelectorAll("*")].filter((e) => (e.textContent || "").trim() && e.children.length === 0).pop()
    : null;
  // Everything in ABSOLUTE (document) coordinates, so the result does not depend
  // on reaching the exact bottom scroll offset:
  //   at maximum scroll the last `ih - fixedTop` px of the viewport are chrome.
  //   A content pixel is hidden iff its distance to the document end is smaller
  //   than that chrome height.
  const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const toEnd = (el) => (el ? Math.round(docH - (el.getBoundingClientRect().bottom + window.scrollY)) : null);
  const chromeH = Math.round(document.documentElement.clientHeight - fixedTop);
  const footerGap = toEnd(footer);
  const lastTextGap = toEnd(lastTextEl);
  return {
    ih: window.innerHeight,
    scrollY: Math.round(window.scrollY),
    docH: Math.round(docH),
    chromeTop: Math.round(fixedTop),
    chromeH,
    footerGap,
    lastTextGap,
    footerClearance: footerGap === null ? null : footerGap - chromeH,
    lastTextClearance: lastTextGap === null ? null : lastTextGap - chromeH,
    lastText: (lastTextEl?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
  };
};

async function openDetail(page) {
  await page.goto("http://kc.local/#/products", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  // Product cards navigate via onClick (not anchors), so open the first card.
  const t = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-slot="card"]')].filter((c) => /buy now/i.test(c.textContent || ""));
    if (!cards.length) return null;
    const title = cards[0].querySelector("h3, [class*=line-clamp]");
    (title || cards[0]).click();
    return (title?.textContent || "").trim().slice(0, 30);
  });
  if (!t) return null;
  await page.waitForFunction(() => window.location.hash.includes("/products/"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const url = page.url();
  if (!url.includes("/products/")) return null;
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  return url;
}
const DESKTOP_ONLY = process.argv.includes("desktop");
const MOBILE_ONLY = process.argv.includes("mobile");

/** Do any two of these boxes intersect? (1px tolerance for shared edges) */
const anyOverlap = (boxes) => {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) return [{ a: `${a.x},${a.y} ${a.w}x${a.h}`, b: `${b.x},${b.y} ${b.w}x${b.h}`, ox, oy }];
    }
  }
  return [];
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const results = {};

for (const [label, root] of MOBILE_ONLY ? ROOTS.filter(([l]) => l === "new") : ROOTS) {
  results[label] = { mobile: {}, desktop: null };
  for (const width of DESKTOP_ONLY ? [] : label === "before" ? [390] : [320, 360, 375, 390, 430]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));
    await serveFrom(page, root);
    const url = await openDetail(page);
    if (!url) {
      check(`${label}@${width}: product detail reachable`, false, "no product link on the listing page");
      await ctx.close();
      continue;
    }
    const data = await page.evaluate(PROBE);
    const bottom = await page.evaluate(BOTTOM_PROBE);
    data.bottom = bottom;
    data.errors = pageErrors;
    results[label].mobile[width] = data;

    const f = data.features.items;
    console.log(`\n──── ${label} @ ${width}px :: ${url} ────`);
    console.log(`   features=${JSON.stringify(f.map((i) => ({ n: i.name, box: `${i.item?.w}x${i.item?.h}`, x: i.item?.x, y: i.item?.y })))}`);
    console.log(`   strip=${JSON.stringify(data.features.strip)}`);
    console.log(`   tabRows=${JSON.stringify(data.tabRows)}`);
    console.log(`   tabs=${JSON.stringify(data.tabs.map((t) => `${t.label}:${t.box.w}x${t.box.h}@${t.box.x},${t.box.y}`))}`);
    console.log(`   fixed=${JSON.stringify(data.fixed.map((x) => `${x.txt || x.cls.slice(0, 18)}:${x.x},${x.y} ${x.w}x${x.h}`))}`);
    console.log(`   overlaps=${JSON.stringify(data.overlaps)}`);
    console.log(`   bottom=${JSON.stringify(bottom)}`);
    console.log(`   scrollW=${data.scrollW} vw=${data.vw} errors=${JSON.stringify(pageErrors)}`);

    if (width === 390 || width === 320) {
      // Human-readable alignment map (text rendering of the measured boxes) so
      // the layout can be eyeballed without an image viewer.
      const pad = (s, n) => String(s).padEnd(n).slice(0, n);
      console.log(`   ┌─ feature strip @${width}px — columns: ${JSON.stringify([...new Set(data.features.items.map((i) => i.item.x))])}`);
      for (const i of data.features.items) {
        console.log(`   │ x=${pad(i.item.x, 5)} w=${pad(i.item.w, 5)} icon_y=${pad(i.icon?.y, 6)} head_y=${pad(i.heading?.y, 6)} desc_y=${pad(i.desc?.y, 6)} ${pad(i.name, 18)} "${i.descText}"`);
      }
      console.log(`   └─ all three on one row: ${new Set(data.features.items.map((i) => i.item.y)).size === 1}`);
      for (const r of data.tabRows) {
        const cells = data.tabs.filter((t) => t.box.y === r.y);
        console.log(`   tab row y=${pad(r.y, 6)} [${cells.map((c) => pad(`${c.box.x}+${c.box.w}`, 12)).join(" ")}]  ${cells.map((c) => c.label).join(" | ")}`);
      }
    }
    if (width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(SHOTS, `detail-390-${label}-top.png`) });
      // features + tab strip close-up
      const stripEl = await page.evaluateHandle(() => {
        const s = [...document.querySelectorAll("span")].find((x) => (x.textContent || "").trim() === "Fast Delivery");
        return s?.closest("div")?.parentElement || null;
      });
      const sec = await page.evaluateHandle(() => {
        const s = [...document.querySelectorAll("span")].find((x) => (x.textContent || "").trim() === "Fast Delivery");
        const mid = s?.parentElement?.parentElement;
        return mid?.parentElement?.parentElement || mid;
      });
      try {
        if (sec) await sec.asElement()?.screenshot({ path: join(SHOTS, `detail-390-${label}-features.png`) }).catch(() => {});
        if (stripEl) await stripEl.asElement()?.screenshot({ path: join(SHOTS, `detail-390-${label}-featurestrip.png`) }).catch(() => {});
      } catch {}
      const tabHandle = await page.evaluateHandle(() => {
        const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "Product");
        let el = b?.parentElement;
        while (el && !(el.className || "").toString().match(/rounded-2xl/)) el = el.parentElement;
        return el || null;
      });
      try {
        if (tabHandle) await tabHandle.asElement()?.screenshot({ path: join(SHOTS, `detail-390-${label}-tabs.png`) }).catch(() => {});
      } catch {}
      await page.screenshot({ path: join(SHOTS, `detail-390-${label}-full.png`), fullPage: true });
    }
    await ctx.close();
  }

  // ── desktop ─────────────────────────────────────────────────────────────
  if (!MOBILE_ONLY) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await serveFrom(page, root);
    await openDetail(page);
    const data = await page.evaluate(PROBE);
    results[label].desktop = data;
    console.log(`\n──── desktop 1440 (${label}) ────`);
    console.log(`   features=${JSON.stringify(data.features.items.map((i) => `${i.item?.w}x${i.item?.h}@${i.item?.x},${i.item?.y}`))}`);
    console.log(`   strip=${JSON.stringify(data.features.strip)}`);
    console.log(`   tabRows=${JSON.stringify(data.tabRows)}`);
    console.log(`   tabs=${JSON.stringify(data.tabs.map((t) => `${t.shown}:${t.box.w}x${t.box.h}@${t.box.x},${t.box.y}`))}`);
    console.log(`   tabGrid=${JSON.stringify(data.tabGrid)}`);
    if (label === "new") await page.screenshot({ path: join(SHOTS, "detail-1440-new-full.png"), fullPage: true }).catch(() => {});
    else await page.screenshot({ path: join(SHOTS, "detail-1440-before-full.png"), fullPage: true }).catch(() => {});
    await ctx.close();
  }
}

// ── assertions (current source only) ──────────────────────────────────────
for (const width of [320, 360, 375, 390, 430]) {
  const d = results.new.mobile[width];
  if (!d) continue;
  const items = d.features.items;
  check(`W=${width}: three delivery features found`, items.length === 3, JSON.stringify(items.map((i) => i.name)));
  if (items.length === 3) {
    const ys = items.map((i) => i.icon?.y);
    check(`W=${width}: all three icons on ONE row`, new Set(ys).size === 1, JSON.stringify(ys));
    check(`W=${width}: three distinct columns`, new Set(items.map((i) => i.item?.x)).size === 3, JSON.stringify(items.map((i) => i.item?.x)));
    const ws = items.map((i) => i.item?.w);
    check(`W=${width}: three equal-width columns`, new Set(ws).size === 1, JSON.stringify(ws));
    const hy = items.map((i) => i.heading?.y);
    check(`W=${width}: headings aligned on the same line`, new Set(hy).size === 1, JSON.stringify(hy));
    const dy = items.map((i) => i.desc?.y);
    check(`W=${width}: descriptions aligned on the same line`, new Set(dy).size === 1, JSON.stringify(dy));
    const clipped = items.filter((i) => i.desc && i.desc.y + i.desc.h > (i.item.y + i.item.h) + 1);
    check(`W=${width}: descriptions stay inside their column`, clipped.length === 0, JSON.stringify(clipped.map((c) => c.name)));
    const strip = d.features.strip;
    const outside = items.filter((i) => i.item.x < strip.x - 1 || i.item.x + i.item.w > strip.x + strip.w + 1);
    check(`W=${width}: features stay inside the strip (no overflow)`, outside.length === 0, `${strip.w}px strip`);
  }
  check(`W=${width}: no horizontal page overflow`, d.scrollW <= d.vw + 1, `scrollW=${d.scrollW} vw=${d.vw}`);
  check(`W=${width}: no page errors`, (d.errors || []).length === 0, JSON.stringify(d.errors));

  const rows = d.tabRows;
  check(`W=${width}: all nine tabs rendered`, d.tabs.length === 9, JSON.stringify(d.tabs.map((t) => t.label)));
  check(`W=${width}: tabs form balanced rows (max spread = 1, no lone row)`, rows.length > 0 && Math.max(...rows.map((r) => r.labels.length)) - Math.min(...rows.map((r) => r.labels.length)) <= 1, JSON.stringify(rows));
  check(`W=${width}: no tab label clipped`, d.tabs.every((t) => t.labelClipped !== true), JSON.stringify(d.tabs.filter((t) => t.labelClipped).map((t) => t.label)));
  check(`W=${width}: tab touch targets >= 40px tall`, d.tabs.every((t) => t.box.h >= 40), JSON.stringify(d.tabs.map((t) => t.box.h)));
  check(
    `W=${width}: tab icons line up in the same three columns on every row`,
    new Set(d.tabs.map((t) => t.icon?.x)).size === 3 && new Set(d.tabs.map((t) => t.icon?.y)).size === 3,
    JSON.stringify({ xs: [...new Set(d.tabs.map((t) => t.icon?.x))], ys: [...new Set(d.tabs.map((t) => t.icon?.y))] })
  );
  check(
    `W=${width}: every tab label stays on one line`,
    d.tabs.every((t) => (t.labelBox?.h ?? 99) <= 18),
    JSON.stringify(d.tabs.map((t) => `${t.label}:${t.labelBox?.h}`))
  );
  {
    const ys = d.tabRows.map((r) => r.y);
    const pitches = ys.slice(1).map((y, i) => y - ys[i]);
    check(
      `W=${width}: tab rows are evenly pitched`,
      pitches.length > 0 && Math.max(...pitches) - Math.min(...pitches) <= 2,
      JSON.stringify({ ys, pitches })
    );
  }
  check(
    `W=${width}: tab labels are not truncated`,
    d.tabs.every((t) => t.shown === t.label || t.shown.startsWith(t.label)),
    JSON.stringify(d.tabs.map((t) => t.shown))
  );
  const tabHits = anyOverlap(d.tabs.map((t) => t.box));
  check(`W=${width}: no two tab cells touch (tappable gaps)`, tabHits.length === 0, JSON.stringify(tabHits));
  const stripParts = d.features.items.flatMap((i) => [i.icon, i.heading, i.desc].filter(Boolean));
  const stripHits = anyOverlap(stripParts);
  check(`W=${width}: nothing inside the feature strip overlaps`, stripHits.length === 0, JSON.stringify(stripHits));
  check(`W=${width}: tab bar inside the viewport`, d.tabBar ? d.tabBar.x >= 0 && d.tabBar.x + d.tabBar.w <= d.vw + 1 : false, JSON.stringify(d.tabBar));
  check(
    `W=${width}: tabs laid out in a fixed 3-column grid (root cause)`,
    !!d.tabGrid && d.tabGrid.display === "grid" && d.tabGrid.cols.split(" ").length === 3,
    JSON.stringify(d.tabGrid)
  );
  check(
    `W=${width}: delivery features laid out in a fixed 3-column grid (root cause)`,
    !!d.features.strip && d.features.strip.display === "grid" && (d.features.strip.cols || "").split(" ").length === 3,
    JSON.stringify(d.features.strip)
  );

  check(`W=${width}: fixed elements do not overlap each other`, d.overlaps.length === 0, JSON.stringify(d.overlaps));
  const b = d.bottom;
  check(
    `W=${width}: end of page clears the fixed chrome (footer + last line)`,
    b.footerClearance !== null && b.footerClearance >= 8 && b.lastTextClearance !== null && b.lastTextClearance >= 24,
    `chrome=${b.chromeH}px footerClearance=${b.footerClearance} lastLineClearance=${b.lastTextClearance} (${b.lastText})`
  );
}

// Tabs still work: every tab opens ITS OWN section and shows the active state.
if (!DESKTOP_ONLY) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await serveFrom(page, NEW);
  await openDetail(page);
  const TABS = [
    ["Product", "product-info"],
    ["Medical", "medical-benefits"],
    ["Key", "key-ingredients"],
    ["Directions", "directions-for-use"],
    ["Safety", "safety"],
    ["Information", "information"],
    ["FAQs", "faqs"],
    ["Customers", "customers-also-bought"],
    ["Other", "other-links"],
  ];
  const present = await page.evaluate((ids) => ids.filter((id) => document.getElementById(id)), TABS.map(([, id]) => id));
  check("all nine tab targets exist in the DOM", present.length === 9, JSON.stringify(present));

  const results2 = [];
  for (const [label, id] of TABS) {
    const clicked = await page.evaluate((short) => {
      const shown = (b) => [...b.querySelectorAll("span")].filter((s) => s.offsetParent !== null).map((s) => (s.textContent || "").trim()).join("");
      const b = [...document.querySelectorAll("button")].find((x) => shown(x) === short);
      if (!b) return null;
      b.click();
      return true;
    }, label);
    await page.waitForTimeout(1100);
    const state = await page.evaluate((targetId) => {
      const el = document.getElementById(targetId);
      const r = el?.getBoundingClientRect();
      const shown = (b) => [...b.querySelectorAll("span")].filter((s) => s.offsetParent !== null).map((s) => (s.textContent || "").trim()).join("");
      const active = [...document.querySelectorAll("button")].filter((b) => shown(b)).find((b) => Number(getComputedStyle(b).fontWeight) >= 600 && b.querySelector("span.absolute"));
      return { top: r ? Math.round(r.top) : null, active: active ? shown(active) : null };
    }, id);
    results2.push({ label, clicked: !!clicked, target: id, targetTop: state.top, active: state.active });
  }
  console.log(`\n   tab clicks=${JSON.stringify(results2)}`);
  check("every tab click scrolls to its own section", results2.every((c) => c.clicked && c.targetTop !== null && c.targetTop > -400 && c.targetTop < 500), JSON.stringify(results2.map((c) => `${c.label}->${c.target}@${c.targetTop}`)));
  check("the clicked tab shows the active state", results2.every((c) => c.active === c.label), JSON.stringify(results2.map((c) => c.active)));
  await ctx.close();
}

// ── desktop unchanged ─────────────────────────────────────────────────────
{
  const now = results.new.desktop;
  const before = results.before?.desktop;
  if (now && before) {
    const feats = JSON.stringify(now.features.items.map((i) => `${i.item?.w}x${i.item?.h}`));
    const featsB = JSON.stringify(before.features.items.map((i) => `${i.item?.w}x${i.item?.h}`));
    check("desktop: delivery feature boxes unchanged", feats === featsB, `now=${feats} before=${featsB}`);
    check("desktop: delivery features still one row", new Set(now.features.items.map((i) => i.icon?.y)).size === 1, JSON.stringify(now.features.items.map((i) => i.icon?.y)));
    check("desktop: all nine tabs found", now.tabs.length === 9, JSON.stringify(now.tabs.map((t) => t.shown)));
    check("desktop: no phones grid rendered (sm:hidden)", now.tabGrid === null, JSON.stringify(now.tabGrid));
    const tabsNow = JSON.stringify(now.tabs.map((t) => `${t.shown}:${t.box.w}x${t.box.h}@${t.box.x},${t.box.y}`));
    const tabsB = JSON.stringify(before.tabs.map((t) => `${t.shown}:${t.box.w}x${t.box.h}@${t.box.x},${t.box.y}`));
    check("desktop: tab geometry unchanged", tabsNow === tabsB, `\n     now   =${tabsNow}\n     before=${tabsB}`);
    check("desktop: tab rows unchanged", JSON.stringify(now.tabRows) === JSON.stringify(before.tabRows), `now=${JSON.stringify(now.tabRows)} before=${JSON.stringify(before.tabRows)}`);
  }
}

await browser.close();
console.log(failures === 0 ? "\nALL DETAIL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
