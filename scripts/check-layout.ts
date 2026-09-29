import { chromium } from "playwright";

const BASE = "https://sunny-baths-help.freebuff.dev";
const SLUGS = ["dolo-650", "volini-gel", "durex-condom", "accu-chek-active-strips"];
const SECTION_IDS = [
  "product-info",
  "medical-benefits",
  "key-ingredients",
  "directions-for-use",
  "safety",
  "information",
  "faqs",
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const problems: string[] = [];

  for (const slug of SLUGS) {
    await page.goto(`${BASE}/#/products/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const layout = await page.evaluate(() => {
      const table = document.querySelector("table");
      const firstRow = table?.querySelector("tbody tr");
      const cells = firstRow
        ? Array.from(firstRow.querySelectorAll("td")).map((td) =>
            Math.round(td.getBoundingClientRect().width * 100) / 100
          )
        : [];
      return {
        docWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        scrollY: window.scrollY,
        cells,
        image: (() => {
          const img = document.querySelector("img");
          if (!img) return null;
          const r = img.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        })(),
        missingSections: [
          "product-info",
          "medical-benefits",
          "key-ingredients",
          "directions-for-use",
          "safety",
          "information",
          "faqs",
        ].filter((id) => !document.getElementById(id)),
      };
    });

    console.log(
      `${slug}: doc=${layout.docWidth} vp=${layout.viewport} cells=${layout.cells.join(" / ")} img=${layout.image?.w}x${layout.image?.h} scrollY=${layout.scrollY} missing=${layout.missingSections.join(",") || "none"}`
    );

    if (layout.docWidth > layout.viewport + 1) {
      problems.push(`${slug}: horizontal overflow (${layout.docWidth} > ${layout.viewport})`);
    }
    if (layout.cells.length === 2) {
      const [a, b] = layout.cells;
      if (a < 300 || b < 300) {
        problems.push(`${slug}: two-column grid collapsed to ${a} / ${b}`);
      }
    } else {
      problems.push(`${slug}: expected 2 detail columns, got ${layout.cells.length}`);
    }
    if (layout.missingSections.length) {
      problems.push(`${slug}: missing section ids ${layout.missingSections.join(", ")}`);
    }
    if (layout.scrollY !== 0) {
      problems.push(`${slug}: page did not open at the top (scrollY=${layout.scrollY})`);
    }

    // Tab navigation must still scroll to each section.
    for (const id of SECTION_IDS) {
      const tab = await page.$(`button:has-text("${id === "product-info" ? "Product Information" : ""}")`);
      void tab;
    }
    const buttons = await page.$$("button");
    for (const id of SECTION_IDS) {
      const label = id
        .split("-")
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" ");
      const btn = await page.$(`button:has-text("${label}")`);
      if (!btn) continue;
      await btn.click();
      await page.waitForTimeout(700);
      const y = await page.evaluate(() => window.scrollY);
      if (y <= 0) problems.push(`${slug}: clicking "${label}" did not scroll (scrollY=${y})`);
    }
    void buttons;
  }

  await browser.close();
  if (problems.length) {
    console.log("\nLAYOUT PROBLEMS:");
    problems.forEach((p) => console.log(" - " + p));
    process.exit(1);
  }
  console.log("\nLayout and tab navigation OK.");
})();
