import { chromium } from "playwright";

const BASE = "https://sunny-baths-help.freebuff.dev";

const ORAL_MARKERS =
  /\b(swallow|by mouth|dissolve in water|glass of water|course of treatment|missed dose|as directed by your physician)\b/i;
const GENERIC_INGREDIENT = /contributing to the therapeutic effect/i;
const SERVICE_COPY =
  /order online|fast home delivery|pay securely|customer support|check your pincode|we will notify you as soon as it is restocked/i;

type Section = { id: string; heading: string; text: string };

async function collectSlugs(page: any): Promise<string[]> {
  const slugs = new Set<string>();
  for (const path of ["/#/products", "/#/", "/#/products?sort=popular"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const links = await page.$$eval("a[href*='#/products/']", (as: any[]) =>
      as.map((a) => (a.getAttribute("href") || "").split("#/products/")[1]).filter(Boolean)
    );
    links.forEach((l) => slugs.add(l));
  }
  return [...slugs];
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const allSlugs = await collectSlugs(page);
  console.log(`found ${allSlugs.length} product links`);

  // Sample broadly so every product type is covered.
  const sample = allSlugs.filter((_, i) => i % Math.max(1, Math.floor(allSlugs.length / 18)) === 0).slice(0, 18);

  const problems: string[] = [];
  const report: string[] = [];

  for (const slug of sample) {
    await page.goto(`${BASE}/#/products/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);

    const title = await page.$eval("h1", (el: any) => el.textContent?.trim() || "").catch(() => slug);
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
      return ids.map((id) => {
        const el = document.getElementById(id);
        return {
          id,
          heading: el?.querySelector("h3")?.textContent?.trim() || "",
          text: (el?.textContent || "").replace(/\s+/g, " ").trim(),
        };
      });
    });

    const missing = sections.filter((s) => !s.text).map((s) => s.id);
    if (missing.length) problems.push(`${title}: empty sections ${missing.join(", ")}`);

    const joined = sections.map((s) => s.text).join(" | ");
    if (GENERIC_INGREDIENT.test(joined)) {
      problems.push(`${title}: still shows the generic ingredient sentence`);
    }
    if (SERVICE_COPY.test(sections.find((s) => s.id === "information")?.text || "")) {
      problems.push(`${title}: Information section contains website/service copy`);
    }

    const directions = sections.find((s) => s.id === "directions-for-use")?.text || "";
    const info = sections.find((s) => s.id === "product-info")?.text || "";
    // A topical device/condom/supplement must not be told to swallow.
    const nonOral = /condom|strip|meter|monitor|device|glucon|ensure|shampoo|kit/i.test(
      title + info
    );
    if (nonOral && ORAL_MARKERS.test(directions)) {
      problems.push(`${title}: non-oral product received oral instructions`);
    }

    report.push(
      [
        `\n=== ${title} (${slug})`,
        `  benefits: ${
          (sections.find((s) => s.id === "medical-benefits")?.text || "").slice(0, 150)
        }`,
        `  directions: ${(directions || "").slice(0, 220)}`,
        `  faq q1: ${(sections.find((s) => s.id === "faqs")?.text || "").slice(0, 130)}`,
      ].join("\n")
    );
  }

  console.log(report.join("\n"));
  console.log(`\n${"=".repeat(60)}`);
  if (problems.length) {
    console.log(`PROBLEMS (${problems.length}):`);
    problems.forEach((p) => console.log(" - " + p));
  } else {
    console.log("No section-level problems found across " + sample.length + " products.");
  }

  await browser.close();
  process.exit(problems.length ? 1 : 0);
})();
