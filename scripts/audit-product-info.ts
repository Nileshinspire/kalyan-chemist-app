import { chromium } from "playwright";

const BASE = "https://sunny-baths-help.freebuff.dev";
const CONVEX = "https://dutiful-fox-804.convex.cloud";

const ORAL_MARKERS =
  /\b(swallow|by mouth|dissolve in water|glass of water|course of treatment|missed dose|as directed by your physician)\b/i;
const GENERIC_INGREDIENT = /contributing to the therapeutic effect/i;
const SERVICE_COPY =
  /order online|fast home delivery|pay securely|customer support|check your pincode|restocked/i;

type Section = { id: string; text: string };

async function query(path: string, args: any = {}): Promise<any[]> {
  const res = await fetch(`${CONVEX}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const json: any = await res.json();
  if (json.status === "error") return [];
  const value = json.result ?? json.value;
  const rows = value?.result?.items ?? (Array.isArray(value) ? value : []);
  return Array.isArray(rows) ? rows : [];
}

async function listProducts(): Promise<Array<{ slug: string; name: string; form?: string }>> {
  const seen = new Map<string, { slug: string; name: string; form?: string }>();
  for (const path of [
    "publicProducts:hotSellers",
    "publicProducts:valueDeals",
    "publicProducts:newArrivals",
    "publicProducts:featured",
    "publicProducts:popular",
  ]) {
    for (const p of await query(path)) {
      if (p?.slug) seen.set(p.slug, { slug: p.slug, name: p.name, form: p.form });
    }
  }
  return [...seen.values()];
}

(async () => {
  const all = await listProducts();
  console.log(`products from convex: ${all.length}`);
  if (!all.length) {
    console.log("could not read products; aborting");
    process.exit(2);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const problems: string[] = [];
  const report: string[] = [];

  // Cover every product; the catalogue is small enough to check exhaustively.
  const sample = all;

  for (const product of sample) {
    await page.goto(`${BASE}/#/products/${product.slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);

    const sections: Section[] = await page.evaluate(() => {
      const ids = [
        "product-info",
        "medical-benefits",
        "key-ingredients",
        "directions-for-use",
        "safety",
        "information",
        "faqs",
      ];
      return ids.map((id) => ({
        id,
        text: (document.getElementById(id)?.textContent || "").replace(/\s+/g, " ").trim(),
      }));
    });

    const missing = sections.filter((s) => !s.text).map((s) => s.id);
    if (missing.length) problems.push(`${product.name}: empty sections ${missing.join(", ")}`);

    const byId = (id: string) => sections.find((s) => s.id === id)?.text || "";
    const allText = sections.map((s) => s.text).join(" | ");

    if (GENERIC_INGREDIENT.test(allText)) {
      problems.push(`${product.name}: still shows the generic ingredient sentence`);
    }
    if (SERVICE_COPY.test(byId("information"))) {
      problems.push(`${product.name}: Information section contains website/service copy`);
    }
    if (SERVICE_COPY.test(byId("faqs"))) {
      problems.push(`${product.name}: FAQs are service copy, not product copy`);
    }

    const info = byId("product-info");
    const directions = byId("directions-for-use");
    const looksNonOral =
      /condom|strip|meter|monitor|device|shampoo|kit|supplement|diet|glucon|ensure|weigh/i.test(
        product.name + info
      );
    if (looksNonOral && ORAL_MARKERS.test(directions)) {
      problems.push(`${product.name}: non-oral product received oral instructions`);
    }
    if (ORAL_MARKERS.test(byId("medical-benefits"))) {
      problems.push(`${product.name}: benefits mention an oral route`);
    }

    report.push(
      [
        `\n--- ${product.name} [form=${product.form ?? "-"}]`,
        `  INFO  : ${info.slice(0, 260)}`,
        `  BENEFT: ${byId("medical-benefits").slice(0, 190)}`,
        `  DIREC : ${directions.slice(0, 260)}`,
        `  SAFETY: ${byId("safety").slice(0, 170)}`,
        `  FAQ1  : ${byId("faqs").slice(0, 200)}`,
      ].join("\n")
    );
  }

  console.log(report.join("\n"));
  console.log(`\n${"=".repeat(60)}\nchecked ${sample.length} products`);
  if (problems.length) {
    console.log(`PROBLEMS (${problems.length}):`);
    problems.forEach((p) => console.log(" - " + p));
  } else {
    console.log("No section-level problems found.");
  }

  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
