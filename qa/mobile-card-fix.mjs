// Verify the mobile product-card + "Why Choose Us" card geometry fix.
// Usage: node qa/mobile-card-fix.mjs
//
// The public preview is not always reachable, so the render is verified from a
// local build of the current source (dist-verify, produced with
// `vite build --outDir dist-verify`) served through Playwright route
// interception. The last shipped bundle (dist, built before these changes) is
// served the same way and measured for the "desktop unchanged" comparison.
//
// Part A — mobile widths (320/360/375/390/430): every product card in the
// homepage carousels (outer box, image band, buttons) and the four
// "Why Choose Us" feature cards (width / height / icon / heading alignment),
// plus page-level horizontal overflow. Saves mobile screenshots.
// Part B — desktop (1440): the same product sections measured in dist-verify and
// dist.
import { chromium } from "playwright-core";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const OLD = join(process.cwd(), process.env.KC_OLD_ROOT || "dist");
const NEW = join(process.cwd(), process.env.KC_NEW_ROOT || "dist-verify");
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

const WHY_TITLES = ["authentic medicines", "expert pharmacists", "fast home delivery", "seamless refills"];

/** Serve a built bundle on the fake host `kc.local` regardless of network. */
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

// Geometry probe shared by every run.
const PROBE = () => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  };

  // ── product carousels: one entry per snap rail ──
  const rails = [...document.querySelectorAll('[class*="snap-x"]')]
    .map((rail) => {
      const cards = [...rail.children]
        .map((child) => {
          const card = child.querySelector('[data-slot="card"]') || child;
          const band =
            card.querySelector('div[class*="h-24"]') ||
            card.querySelector('div[class*="h-28"]') ||
            card.querySelector('div[class*="h-32"]') ||
            card.querySelector('div[class*="h-44"]') ||
            card.querySelector('div[class*="h-40"]') || card;
          const img = card.querySelector("img");
          const buttons = [...card.querySelectorAll("button")].map((b) => ({ label: (b.textContent || "").trim().slice(0, 14), ...box(b) }));
          const c = box(card);
          if (c.w < 60) return null;
          // Only commerce product cards (a cart / buy action) take part in the
          // product-card checks; service, lab-test and brand rails are excluded.
          const isProduct = buttons.some((b) => /buy now|cart|out of stock/i.test(b.label));
          return { card: c, band: band ? box(band) : null, img: img ? box(img) : null, buttons, isProduct, head: rail.closest("section")?.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 28) || "?" };
        })
        .filter(Boolean);
      const productCards = cards.filter((c) => c.isProduct);
      if (!productCards.length) return null;
      cards.splice(0, cards.length, ...productCards);
      if (!cards.length) return null;
      const r = rail.getBoundingClientRect();
      return { y: Math.round(r.top + window.scrollY), gap: getComputedStyle(rail).gap, cards };
    })
    .filter(Boolean)
    .slice(0, 6);

  // ── product GRIDS (e.g. "Best Deals"): 2-column grids are not snap rails ──
  const grids = [...document.querySelectorAll('div[class*="grid-cols-2"]')]
    .map((grid) => {
      const cards = [...grid.children].map((child) => {
        const buttons = [...child.querySelectorAll("button")].map((b) => ({ label: (b.textContent || "").trim().slice(0, 14), ...box(b) }));
        if (!buttons.some((b) => /buy now|cart|out of stock/i.test(b.label))) return null;

        const band = child.querySelector('div[class*="h-24"], div[class*="h-28"], div[class*="h-32"], div[class*="h-40"], div[class*="h-44"]') || child;

        return {
          card: box(child),
          band: band ? box(band) : null,
          buttons,
          head: grid.closest("section")?.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 28) || "?",
        };
      }).filter(Boolean);

      if (!cards.length) return null;
      return { gap: getComputedStyle(grid).gap, cards };
    }).filter(Boolean);

  const why = [];
  for (const t of ["authentic medicines", "expert pharmacists", "fast home delivery", "seamless refills"]) {
    const h = [...document.querySelectorAll("h3")].find((el) => (el.textContent || "").trim().toLowerCase() === t);
    if (!h) continue;
    const card = h.closest('div[class*="rounded-2xl"]');
    const icon = card?.querySelector('div[class*="size-9"]');
    why.push({ title: t, card: card ? box(card) : null, icon: icon ? box(icon) : null, heading: box(h) });
  }
  const first = [...document.querySelectorAll("h3")].find((h) => /authentic medicines/i.test(h.textContent || ""));
  const grid = first?.closest("div")?.parentElement?.parentElement;
  let whyGrid = null;
  if (grid) {
    const cs = getComputedStyle(grid);
    whyGrid = { display: cs.display, cols: cs.gridTemplateColumns, autoRows: cs.gridAutoRows, gap: cs.gap };
  }

  return {
    vw: document.documentElement.clientWidth,
    scrollW: document.documentElement.scrollWidth,
    rails,
    grids,
    why,
    whyGrid,
  };
};

async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.9);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

async function open(page) {
  await page.goto("http://kc.local/#/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  await settle(page);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });

// ─────────────────────────── Part A — mobile ───────────────────────────
for (const width of [320, 360, 375, 390, 430]) {
  console.log(`\n──── dist-verify @ ${width}px (mobile, cardTail thereafter) ────`);
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));
  await serveFrom(page, NEW);
  await open(page);
  const data = await page.evaluate(PROBE);

  check(`W=${width}: no page horizontal overflow`, data.scrollW <= data.vw + 1, `scrollW=${data.scrollW} vw=${data.vw}`);
  check(`W=${width}: no page errors`, pageErrors.length === 0, JSON.stringify(pageErrors));

  if (!data.rails.length) check(`W=${width}: product carousels found`, false);

  const heights = data.rails.flatMap((r) => r.cards.map((c) => c.card.h));
  const widths = data.rails.flatMap((r) => r.cards.map((c) => c.card.w));
  check(
    `W=${width}: product card widths consistent (108-200px)`,
    widths.length > 0 && widths.every((w) => w >= 108 && w <= 200),
    JSON.stringify(widths)
  );
  // Mobile card = square image band + compact body. The square band replaces the
  // old 96px strip, so the bound is 400px with a tight cap on the body itself.
  const bodyHeights = data.rails.flatMap((r) => r.cards.map((c) => c.card.h - (c.band?.h || 0)));
  check(
    `W=${width}: every product card is compact (<= 400px tall)`,
    heights.length > 0 && heights.every((h) => h <= 400),
    JSON.stringify(heights)
  );
  check(
    `W=${width}: every product card body is compact (<= 210px below the image)`,
    bodyHeights.length > 0 && bodyHeights.every((h) => h > 0 && h <= 210),
    JSON.stringify(bodyHeights)
  );
  check(
    `W=${width}: cards inside one carousel share a height`,
    data.rails.every((r) => new Set(r.cards.map((c) => c.card.h)).size <= 2),
    JSON.stringify(data.rails.map((r) => r.cards.map((c) => c.card.h)))
  );
  // Apollo-style mobile image area: square, sized from the card width.
  check(
    `W=${width}: every product card uses a square mobile image band (band.h === band.w)`,
    data.rails.every((r) => r.cards.every((c) => c.band && Math.abs(c.band.h - c.band.w) <= 2)),
    JSON.stringify(data.rails.map((r) => r.cards.map((c) => (c.band ? `${c.band.w}x${c.band.h}` : null))))
  );
  // Every carousel must be internally uniform: a stray band size inside one
  // lane would mean a card rendered with a different image area than its
  // siblings (the old "17px WhatsApp pill lane" symptom).
  const laneBands = data.rails.map((r) => [...new Set(r.cards.map((c) => (c.band ? `${c.band.w}x${c.band.h}` : null)))]);
  check(
    `W=${width}: every carousel's image bands share one size`,
    laneBands.length > 0 && laneBands.every((b) => b.length === 1),
    JSON.stringify(laneBands)
  );
  const btnH = data.rails.flatMap((r) => r.cards.flatMap((c) => c.buttons.map((b) => b.h)));
  check(
    `W=${width}: touch buttons >= 30px tall`,
    btnH.length > 0 && btnH.every((h) => h >= 30),
    JSON.stringify(btnH)
  );
  check(
    `W=${width}: no card shows its WhatsApp icon as a 17px pill`,
    !btnH.some((h) => h === 17),
    JSON.stringify(btnH.filter((h) => h === 17))
  );

  // product images stay inside their (now shorter) band and stay centred
  const withImg = data.rails.flatMap((r) => r.cards).filter((c) => c.img && c.band && c.img.w > 0);
  const outOfBand = withImg.filter((c) => c.img.y < c.band.y - 2 || c.img.y + c.img.h > c.band.y + c.band.h + 2);
  const offCentre = withImg.filter(
    (c) => Math.abs(c.img.x + c.img.w / 2 - (c.band.x + c.band.w / 2)) > 3
  );
  check(`W=${width}: product images contained in the image band`, withImg.length > 0 && outOfBand.length === 0, `${withImg.length} images`);
  check(`W=${width}: product images horizontally centred`, offCentre.length === 0, JSON.stringify(offCentre.map((c) => c.card.w)));
  check(
    `W=${width}: product images visibly sized (>= 60px wide)`,
    withImg.every((c) => c.img.w >= 60),
    JSON.stringify(withImg.map((c) => c.img.w))
  );
  const clipped = data.rails.flatMap((r) =>
    r.cards.filter((c) => c.buttons.some((b) => b.x < c.card.x - 1 || b.x + b.w > c.card.x + c.card.w + 1)).map((c) => c.card.w)
  );
  check(`W=${width}: no button escapes its card`, clipped.length === 0, JSON.stringify(clipped));

  for (const g of data.grids) {
    const gh = g.cards.map((c) => c.card.h);
    const gw = g.cards.map((c) => c.card.w);
    const gb = g.cards.map((c) => c.band?.h).filter(Boolean);
    console.log(`   grid[${g.cards[0].head}] gap=${g.gap} cards=${JSON.stringify(g.cards.map((c) => `${c.card.w}x${c.card.h}`))} bands=${JSON.stringify(gb)}`);
    check(`W=${width}: product grid ${g.cards[0].head} cards equal width`, new Set(gw).size === 1, JSON.stringify(gw));
    check(`W=${width}: product grid ${g.cards[0].head} cards equal height`, new Set(gh).size === 1, JSON.stringify(gh));
    check(`W=${width}: product grid ${g.cards[0].head} compact (<= 400px)`, gh.every((h) => h <= 400), JSON.stringify(gh));
    check(`W=${width}: product grid ${g.cards[0].head} image band is square and uniform`, new Set(gb).size === 1 && g.cards.every((c) => c.band && Math.abs(c.band.h - c.band.w) <= 2), `grid=${JSON.stringify(gb)}`);
    const clipped = g.cards.filter((c) => c.buttons.some((b) => b.x < c.card.x - 1 || b.x + b.w > c.card.x + c.card.w + 1));
    check(`W=${width}: product grid ${g.cards[0].head} buttons inside their card`, clipped.length === 0, JSON.stringify(clipped.length));
    check(`W=${width}: product grid ${g.cards[0].head} buttons >= 30px tall`, g.cards.flatMap((c) => c.buttons.map((b) => b.h)).every((h) => h >= 30));
  }

  if (data.why.length === 4) {
    const wh = data.why.map((c) => c.card.h);
    const ww = data.why.map((c) => c.card.w);
    check(`W=${width}: four feature cards equal height`, new Set(wh).size === 1, JSON.stringify(wh));
    check(`W=${width}: four feature cards equal width`, new Set(ww).size === 1, JSON.stringify(ww));
    check(
      `W=${width}: feature icons aligned in a 2x2 (2 x-positions, 2 y-positions)`,
      new Set(data.why.map((c) => c.icon?.x)).size === 2 && new Set(data.why.map((c) => c.icon?.y)).size === 2,
      JSON.stringify(data.why.map((c) => ({ x: c.icon?.x, y: c.icon?.y })))
    );
    check(
      `W=${width}: feature headings share their column (2 x-positions)`,
      new Set(data.why.map((c) => c.heading.x)).size === 2,
      JSON.stringify(data.why.map((c) => c.heading.x))
    );
    console.log(`   whyGrid=${JSON.stringify(data.whyGrid)} heights=${JSON.stringify(wh)} widths=${JSON.stringify(ww)}`);
  } else {
    check(`W=${width}: all four feature cards found`, false, `found=${data.why.length}`);
  }

  console.log(
    `   sectors=${JSON.stringify(
      data.rails.map((r) => ({ head: r.cards[0]?.head, gap: r.gap, cards: r.cards.map((c) => `${c.card.w}x${c.card.h}`) }))
    )}`
  );
  console.log(`   images=${JSON.stringify(withImg.map((c) => `${c.img.w}x${c.img.h}@band${c.band.h}`))}`);

  if (width === 390) {
    await page.screenshot({ path: join(SHOTS, "fix-mobile-390-full.png"), fullPage: true });
    for (const [name, needle] of [
      ["fix-mobile-390-hot-sellers.png", "Hot Sellers"],
      ["fix-mobile-390-new-arrivals.png", "New Arrivals"],
      ["fix-mobile-390-best-deals.png", "Best Deals Right Now"],
    ]) {
      const sec = page.locator(`h2:has-text("${needle}")`) .first() .locator("xpath=ancestor::section[1]");
      if (await sec.count()) await sec.screenshot({ path: join(SHOTS, name) }).catch(() => {});
    }
    const whySec = page.locator('h3:has-text("Authentic Medicines")') .first() .locator("xpath=ancestor::section[1]");
    if (await whySec.count()) await whySec.screenshot({ path: join(SHOTS, "fix-mobile-390-why-choose-us.png") }).catch(() => {});
  }
  await ctx.close();
}

// ─────────────────── Part B — desktop, new vs last shipped ───────────────────
async function desktopMeasure(root) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await serveFrom(page, root);
  await open(page);
  const rails = await page.evaluate(PROBE);
  const sections = [];
  for (const name of ["Hot Sellers", "New Arrivals", "Best Deals Right Now", "Value Deals Under"]) {
    const sec = page.locator(`h2:has-text("${name}")`) .first() .locator("xpath=ancestor::section[1]");
    if (!(await sec.count())) continue;
    const card = sec.locator('[data-slot="card"]') .first();
    const target = (await card.count()) ? card : sec.locator(".group.rounded-2xl") .first();
    const info = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const band = el.querySelector('div[class*="h-24"], div[class*="h-44"], div[class*="h-40"], div[class*="h-32"], div[class*="h-28"]') || el;

      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        band: band ? Math.round(band.getBoundingClientRect().height) : null,
      };
    });
    sections.push({ section: name, ...info });
  }
  const shot = await page.screenshot({ path: join(SHOTS, `fix-desktop-1440-${root === NEW ? "new" : "before"}.png`), fullPage: true }).catch(() => null);
  await ctx.close();
  return { rails: rails.rails.map((r) => r.cards.map((c) => `${c.card.w}x${c.card.h}`)), why: rails.why.map((c) => `${c.card.w}x${c.card.h}`), sections, shot };
}

console.log("\n──── desktop 1440: current source (dist-verify) ────");
const now = await desktopMeasure(NEW);
console.log(`   carousels=${JSON.stringify(now.rails)}`);
console.log(`   why=${JSON.stringify(now.why)}`);
console.log(`   sections=${JSON.stringify(now.sections)}`);

console.log("\n──── desktop 1440: last shipped bundle (dist) ────");
const before = await desktopMeasure(OLD);
console.log(`   carousels=${JSON.stringify(before.rails)}`);
console.log(`   why=${JSON.stringify(before.why)}`);
console.log(`   sections=${JSON.stringify(before.sections)}`);

for (const s of now.sections) {
  const b = before.sections.find((x) => x.section === s.section);
  if (!b) continue;
  check(`desktop: ${s.section} card box unchanged`, s.h === b.h && s.w === b.w, `now=${s.w}x${s.h} before=${b.w}x${b.h}`);
}
const sameCount = JSON.stringify(now.rails) === JSON.stringify(before.rails);
check("desktop: carousel card heights unchanged", sameCount, `now=${JSON.stringify(now.rails)} before=${JSON.stringify(before.rails)}`);
const whySame = JSON.stringify(now.why) === JSON.stringify(before.why);
check("desktop: Why Choose Us cards unchanged", whySame, `now=${JSON.stringify(now.why)} before=${JSON.stringify(before.why)}`);

await browser.close();
console.log(failures === 0 ? "\nALL CARD CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
