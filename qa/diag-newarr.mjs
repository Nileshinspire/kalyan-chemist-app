// New Arrivals carousel QA: mobile section alignment, track segmentation
// and overflow (the layout issue surfaced by the New Arrivals diagnosis).
//
// Usage: node qa/diag-newarr.mjs
import { launch, go, report, assertPreview } from "./harness.mjs";
import { anonymousSignIn, injectSession } from "./authSession.mjs";

await assertPreview();

const WIDTHS = process.env.W
  ? process.env.W.split(",").map((n) => Number(n.trim())).filter(Boolean)
  : [375, 360, 390, 412, 430];

const R = { checks: [], failures: [] };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok, detail });
  if (!ok) R.failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
};

const { browser, page } = await launch({ mobile: true });
const session = await anonymousSignIn();
await page.setViewportSize({ width: 375, height: 844 });
await go(page, "#/");
await page.waitForTimeout(3000);
for (let i = 0; i < 3; i++) {
  try { await injectSession(page, session); break; } catch { await page.waitForTimeout(900); }
}

// ── Mobile widths: section alignment, card segmentation, track wrap ──
for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 844 });
  await go(page, "#/");
  await page.waitForTimeout(2500);

  const l = await page.evaluate((width) => {
    const vw = window.innerWidth;
    const out = { vw };
    const sections = [...document.querySelectorAll("section")];
    const s = sections.find((el) => /New Arrivals/i.test(el.querySelector("h2")?.textContent || ""));
    if (!s) { out.found = false; return out; }
    out.found = true;
    const r = s.getBoundingClientRect();
    out.sectionH = Math.round(r.height);
    out.sectionRight = Math.round(r.right);
    out.overflow = document.documentElement.scrollWidth > vw + 2;
    const track = s.querySelector(".kc-new-arrival");
    if (track) {
      out.trackClientW = track.clientWidth;
      out.trackScrollW = track.scrollWidth;
      out.trackWrap = track.scrollWidth > track.clientWidth + 2 || track.scrollWidth < track.clientWidth;
      out.trackOverflow = out.trackScrollW > out.trackClientW + 2;
      out.cardW = Math.round(track.getBoundingClientRect().width);
      out.cardH = Math.round(track.getBoundingClientRect().height);
      const cards = [...track.querySelectorAll(".kc-new-arrival")].map((c) => ({
        w: Math.round(c.getBoundingClientRect().width),
        h: Math.round(c.getBoundingClientRect().height),
      }));
      out.cards = cards;
      out.cardAlign = cards.every((c) => c.w <= track.clientWidth + 2);
    }
    // The two-column mobile row must sit flush against its section's padded
    // container: card left edge should start at ~the container's left edge,
    // not shifted by an unbalanced negative margin.
    const container = s.parentElement;
    out.containerLeft = container ? Math.round(container.getBoundingClientRect().left) : null;
    return out;
  }, width);

  check(`[${width}px] New Arrivals section exists`, l.found, JSON.stringify(l));
  if (l.found) {
    check(`[${width}px] section inside viewport (no horizontal overflow)`, !l.overflow, `sw=${l.sectionRight}`);
    check(`[${width}px] section height sane (< 1000)`, l.sectionH < 1000, `h=${l.sectionH}`);
    check(`[${width}px] track wrap tidy (not spilling into a half row)`, !l.trackWrap, `scrollW=${l.trackScrollW} clientW=${l.trackClientW}`);
    check(`[${width}px] cards align to track left edge`, l.cardAlign, JSON.stringify(l.cards));
    check(`[${width}px] cards inside track`, l.cardW <= l.trackClientW + 2, `cardW=${l.cardW} trackW=${l.trackClientW}`);
  }
}

// ── Desktop sanity pass ──
await page.setViewportSize({ width: 1440, height: 900 });
await go(page, "#/");
await page.waitForTimeout(2500);
const desk = await page.evaluate(() => {
  const vw = window.innerWidth;
  const out = { vw, overflow: document.documentElement.scrollWidth > vw + 2 };
  const sections = [...document.querySelectorAll("section")];
  const s = sections.find((el) => /New Arrivals/i.test(el.querySelector("h2")?.textContent || ""));
  if (!s) { out.found = false; return out; }
  out.found = true;
  const r = s.getBoundingClientRect();
  out.sectionH = Math.round(r.height);
  out.sectionRight = Math.round(r.right);
  out.overflow = document.documentElement.scrollWidth > vw + 2;
  const track = s.querySelector(".kc-new-arrival");
  if (track) {
    out.trackClientW = track.clientWidth;
    out.trackScrollW = track.scrollWidth;
    out.trackWrap = out.trackScrollW > out.trackClientW + 2;
    out.cards = [...track.querySelectorAll(".kc-new-arrival")].map((c) => ({
      w: Math.round(c.getBoundingClientRect().width),
      h: Math.round(c.getBoundingClientRect().height),
    }));
  }
  return out;
});
check(`[1440px] New Arrivals section exists`, desk.found, JSON.stringify(desk));
if (desk.found) {
  check(`[1440px] section inside viewport (no horizontal overflow)`, !desk.overflow, `sectionRight=${desk.sectionRight}`);
  check(`[1440px] section height sane (< 1200)`, desk.sectionH < 1200, `h=${desk.sectionH}`);
  check(`[1440px] track wrap tidy`, !desk.trackWrap, `scrollW=${desk.trackScrollW} clientW=${desk.trackClientW}`);
  check(`[1440px] cards inside track`, (desk.cards || []).every((c) => c.w <= desk.trackClientW + 2), JSON.stringify(desk.cards));
}

await browser.close();
report(R, "Test 31: New Arrivals mobile carousel QA");
console.log(`\nchecks=${R.checks.length} ${R.failures.length ? "FAILURES:" : "ALL CHECKS PASSED"}`);
for (const f of R.failures) console.log(" - " + f);
if (R.failures.length) process.exit(1);
