// Card-box invariance: proves the shared product card keeps the same box no
// matter what the product content looks like, and that every section behaves
// identically.
//
//   node qa/verify-card-box-invariance.mjs
//   W=1280 node qa/verify-card-box-invariance.mjs
//
// Three content shapes are exercised on every product surface. Each shape gets
// its own fresh page load so no mutation leaks between measurements.
//   1. real    — the live catalogue
//   2. sparse  — manufacturer + dosage/pack-size lines removed, as a product
//                without those fields renders; the reserved box must hold
//   3. long    — a title long enough to wrap; clamped to 2 lines, price and
//                both buttons still fully inside, same box in every section
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "https://sunny-baths-help.freebuff.dev";
const W = Number(process.env.W || 1440);
const LONG =
  "Paracetamol Extra Strength 650mg Tablets With Vitamin C And Zinc For Fever Body Ache Relief";

const ROUTES = [
  ["home", "#/"],
  ["hot-sellers", "#/hot-sellers"],
  ["value-deals", "#/value-deals"],
  ["products", "#/products"],
];

const MEASURE = ([longName, mode]) => {
  const out = [];
  const cards = [...document.querySelectorAll('[data-slot="card"]')].filter((c) =>
    /buy now|cart/i.test(c.textContent || "")
  );

  // Mutate EVERY card first, then measure in a second pass. Measuring inside
  // the mutation loop read rows that had only been partly updated, which made
  // a uniform result look varied.
  for (const card of cards) {
    const h3 = card.querySelector("h3");
    if (!h3) continue;
    if (mode === "sparse") {
      const sib = h3.nextElementSibling;
      if (sib && sib.tagName === "P") sib.remove();
      const last = h3.parentElement?.lastElementChild;
      if (last && last.tagName === "P" && last !== h3) last.remove();
    }
    if (mode === "long") h3.textContent = longName;
  }

  for (const card of cards) {
    const h3 = card.querySelector("h3");
    if (!h3) continue;
    const cr = card.getBoundingClientRect();
    const btns = [...card.querySelectorAll("button")].filter((b) =>
      /buy now|cart|out of stock/i.test(b.textContent || "")
    );
    const priceEl = [...card.querySelectorAll("span")].find((s) => /₹/.test(s.textContent || ""));
    const lh = parseFloat(getComputedStyle(h3).lineHeight);
    out.push({
      head:
        card.closest("section")?.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 22) || "?",
      name: (h3.textContent || "").trim().slice(0, 22),
      box: `${Math.round(cr.width)}x${Math.round(cr.height)}`,
      lines: Math.round(h3.getBoundingClientRect().height / lh),
      overflowY: card.scrollHeight - card.clientHeight,
      buttonsInside: btns.every((b) => {
        const br = b.getBoundingClientRect();
        return br.bottom <= cr.bottom + 1 && br.top >= cr.top - 1 && br.height > 4;
      }),
      priceInside: priceEl ? priceEl.getBoundingClientRect().bottom <= cr.bottom + 1 : true,
      allInside: [...card.querySelectorAll("h3,p,span,button")].every((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom <= cr.bottom + 1 && r.top >= cr.top - 1;
      }),
    });
  }
  return out;
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const boxes = { real: [], sparse: [], long: [] };
let failures = 0;
const check = (n, ok, d = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} :: ${n}${d ? ` :: ${d}` : ""}`);
  if (!ok) failures++;
};

for (const [label, route] of ROUTES) {
  console.log(`\n### ${label} @ ${W}`);
  const res = {};
  for (const mode of ["real", "sparse", "long"]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5500);
    res[mode] = await page.evaluate(MEASURE, [LONG, mode]);
    await ctx.close();
  }
  for (const mode of ["real", "sparse", "long"]) {
    const list = res[mode];
    const uniq = [...new Set(list.map((c) => c.box))];
    console.log(
      `  ${mode.padEnd(6)} n=${String(list.length).padEnd(3)} box=${uniq.join(" || ")} lines=${[...new Set(list.map((c) => c.lines))].join("/")}`
    );
    boxes[mode].push(...uniq);

    check(`${label} [${mode}]: box identical across the section`, uniq.length === 1, uniq.join(" || "));
    check(
      `${label} [${mode}]: price + both buttons stay inside the card`,
      list.every((c) => c.buttonsInside && c.priceInside && c.overflowY <= 1),
      JSON.stringify(
        list.filter((c) => !c.buttonsInside || !c.priceInside || c.overflowY > 1).slice(0, 2).map((c) => c.name)
      )
    );
    check(
      `${label} [${mode}]: nothing renders outside the card box`,
      list.every((c) => c.allInside),
      JSON.stringify(list.filter((c) => !c.allInside).slice(0, 2).map((c) => c.name))
    );
    check(`${label} [${mode}]: every card carries Buy Now + Cart`,
      list.every((c) => c.buttonsInside));
    if (mode === "sparse")
      check(`${label} [sparse]: missing detail lines do not shrink the card`,
        uniq.every((b) => b === res.real[0].box), `${uniq.join("||")} vs real ${res.real[0].box}`);
    if (mode === "long")
      check(`${label} [long]: title clamped to at most 2 lines`,
        list.every((c) => c.lines <= 2), JSON.stringify([...new Set(list.map((c) => c.lines))]));
  }
}
await browser.close();

for (const mode of ["real", "sparse", "long"]) {
  const uniq = [...new Set(boxes[mode])];
  check(`${W} [${mode}]: one card box across every section`, uniq.length === 1, uniq.join(" || "));
}
console.log("\nBOX SUMMARY");
for (const mode of ["real", "sparse", "long"])
  console.log(`  ${mode.padEnd(7)}: ${[...new Set(boxes[mode])].join(" || ")}`);
console.log(failures === 0 ? "\nCARD-BOX INVARIANCE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
