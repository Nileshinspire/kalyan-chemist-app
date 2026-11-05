import { chromium } from "playwright-core";

const BASE = "https://sunny-baths-help.freebuff.dev/preview-templates.html";
const EXPECTED = {
  health: "health",
  diwali: "diwali",
  holi: "holi",
  christmas: "christmas",
  offer: "offer",
  announcement: "announcement",
  order: "order",
  neutral: "neutral",
  image: "festival",
};
const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${extra ? " :: " + extra : ""}`);
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  for (const device of [
    { label: "desktop", viewport: { width: 1440, height: 1000 } },
    { label: "mobile", viewport: { width: 390, height: 844 } },
  ]) {
    const page = await browser.newPage({ viewport: device.viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);

    const sections = page.locator("[data-fixture]");
    check(`${device.label}: all fixtures rendered`, (await sections.count()) === Object.keys(EXPECTED).length, String(await sections.count()));

    for (const [fixture, expected] of Object.entries(EXPECTED)) {
      const section = page.locator(`[data-fixture="${fixture}"]`);
      const tmpl = await section.locator("[data-notification-template]").first().getAttribute("data-notification-template");
      const hero = await section.locator("[data-notification-hero]").first().getAttribute("data-notification-hero").catch(() => null);
      check(`${device.label}: ${fixture} uses the ${expected} template`, tmpl === expected, `template=${tmpl} hero=${hero}`);
    }

    // Different festivals must not share artwork or the same hero.
    const heroes = {};
    for (const fixture of ["diwali", "holi", "christmas", "health", "offer", "announcement", "order", "neutral"]) {
      const section = page.locator(`[data-fixture="${fixture}"]`);
      heroes[fixture] = await section.locator("[data-notification-hero]").first().getAttribute("data-notification-hero");
      const bg = await section.locator("[data-notification-hero]").first().evaluate((el) => getComputedStyle(el).backgroundImage);
      check(`${device.label}: ${fixture} has its own hero artwork + palette`, Boolean(bg) && bg !== "none", bg.slice(0, 60));
    }
    check(`${device.label}: holi/diwali/christmas hero ids differ`, new Set([heroes.diwali, heroes.holi, heroes.christmas]).size === 3, JSON.stringify(heroes));

    // Content is preserved in full.
    const html = await page.locator("body").innerText();
    check(`${device.label}: full long health message is shown`, html.includes("Elderly family members and children need extra attention on hot days."));
    check(`${device.label}: offer text preserved`, html.includes("Browse the offer section to see what applies to your cart."));
    check(`${device.label}: announcement text preserved`, html.includes("Orders placed during this window will be confirmed as soon as service resumes."));
    check(`${device.label}: real uploaded image is displayed`, (await page.locator('[data-fixture="image"] img').count()) === 1);
    check(`${device.label}: no broken image placeholders`, (await page.locator('img[alt=""]').count()) === 0);

    // Layout: no horizontal overflow, card fits the viewport, footer stays reachable.
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    check(`${device.label}: no horizontal page overflow`, overflow.doc <= 1, `overflow=${overflow.doc}px`);

    const boxes = await page.locator("[data-fixture] > div").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) };
      }),
    );
    check(
      `${device.label}: every card fits the viewport width`,
      boxes.every((b) => b.left >= 0 && b.right <= device.viewport.width + 1),
      JSON.stringify(boxes[0]),
    );

    // Title typography actually differs between templates.
    const titleStyles = await page.evaluate(() => {
      const out = {};
      for (const key of ["health", "offer", "diwali", "announcement", "order"]) {
        const h = document.querySelector(`[data-fixture="${key}"] h2`);
        if (!h) continue;
        const cs = getComputedStyle(h);
        out[key] = `${cs.fontFamily.split(",")[0]} | ${cs.fontWeight} | ${cs.fontSize}`;
      }
      return out;
    });
    check(`${device.label}: health/offer/announcement typography differs`, new Set(Object.values(titleStyles)).size >= 3, JSON.stringify(titleStyles));

    check(`${device.label}: no runtime errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
    await page.close();
  }
} finally {
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
}
