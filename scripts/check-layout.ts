import { chromium } from "playwright";

const BASE = "https://sunny-baths-help.freebuff.dev";
const SLUGS = ["dolo-650", "volini-gel", "durex-condom", "accu-chek-active-strips"];
const SECTION_LABELS = [
  "Product Information",
  "Medical Benefits",
  "Key Ingredients",
  "Directions for Use",
  "Safety",
  "Information",
  "Frequently Asked Questions",
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const problems: string[] = [];

  for (const slug of SLUGS) {
    await page.goto(`${BASE}/#/products/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const layout = await page.evaluate(() => {
      const image = document.querySelector("main img");
      const imageCard = image?.closest("div")?.parentElement;
      const table = document.querySelector("main table");
      // The details grid is the row holding the image card and the table card.
      const grid = table?.closest(".grid") as HTMLElement | null;
      const cards = grid
        ? Array.from(grid.children).map((c) => Math.round(c.getBoundingClientRect().width))
        : [];
      return {
        docWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        scrollY: window.scrollY,
        cards,
        tableWidth: table ? Math.round(table.getBoundingClientRect().width) : 0,
        image: image
          ? {
              w: Math.round(image.getBoundingClientRect().width),
              h: Math.round(image.getBoundingClientRect().height),
              alt: image.alt,
            }
          : null,
        imageCardWidth: imageCard
          ? Math.round(imageCard.getBoundingClientRect().width)
          : 0,
        buttons: Array.from(document.querySelectorAll("main button")).map(
          (b) => b.textContent?.trim() || ""
        ),
      };
    });

    console.log(
      `${slug}: doc=${layout.docWidth} vp=${layout.viewport} grid=${layout.cards.join(" / ")} table=${layout.tableWidth} image=${layout.image?.w}x${layout.image?.h} inCard=${layout.imageCardWidth} scrollY=${layout.scrollY}`
    );

    if (layout.docWidth > layout.viewport + 1) {
      problems.push(`${slug}: horizontal overflow (${layout.docWidth} > ${layout.viewport})`);
    }
    if (layout.cards.length !== 2) {
      problems.push(`${slug}: expected a 2-column image/details grid, got ${layout.cards.length}`);
    } else if (layout.cards[0] < 300 || layout.cards[1] < 300) {
      problems.push(`${slug}: grid columns collapsed to ${layout.cards.join(" / ")}`);
    }
    if (!layout.image || !layout.image.w) problems.push(`${slug}: product image missing`);
    if (layout.image && layout.image.w > layout.imageCardWidth) {
      problems.push(`${slug}: product image overflows its card`);
    }
    for (const label of ["Buy Now", "Add to Cart"]) {
      if (!layout.buttons.some((b) => b.includes(label))) {
        problems.push(`${slug}: "${label}" button missing`);
      }
    }
    if (layout.scrollY !== 0) {
      problems.push(`${slug}: page did not open at the top (scrollY=${layout.scrollY})`);
    }

    for (const label of SECTION_LABELS) {
      const btn = await page.$(`button:has-text("${label}")`);
      if (!btn) {
        problems.push(`${slug}: no tab button for "${label}"`);
        continue;
      }
      await btn.click();
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => ({ y: window.scrollY, active: true }));
      if (state.y <= 0) {
        problems.push(`${slug}: clicking "${label}" did not scroll (scrollY=${state.y})`);
      }
    }
  }

  await browser.close();
  if (problems.length) {
    console.log("\nLAYOUT PROBLEMS:");
    problems.forEach((p) => console.log(" - " + p));
    process.exit(1);
  }
  console.log("\nLayout, image, buttons and tab navigation OK.");
})();
