import { launch, go, report, interesting } from "./harness.mjs";

const { browser, page, consoleErrors, pageErrors, badResponses } = await launch();

// --- A: home page, scroll fully, find the 403 banner image and its context
await go(page, "#/");
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 150));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);
const banner = await page.evaluate(() => {
  const img = document.querySelector('img[src*="pngtree"]');
  if (!img) return null;
  return {
    src: (img.currentSrc || img.src).slice(0, 160),
    alt: img.alt,
    cls: (img.className || "").toString().slice(0, 80),
    rect: JSON.parse(JSON.stringify(img.getBoundingClientRect())),
    parentText: (img.closest("section")?.innerText || img.parentElement?.parentElement?.innerText || "").replace(/\s+/g, " ").slice(0, 120),
    parentHtml: (img.parentElement?.outerHTML || "").slice(0, 300),
  };
});
const allExternal = await page.evaluate(() =>
  Array.from(document.images)
    .filter((i) => /^https?:/.test(i.src) && !i.src.includes("sunny-baths-help") && !i.src.includes("convex"))
    .map((i) => ({ src: i.src.slice(0, 110), ok: i.complete && i.naturalWidth > 0, alt: i.alt }))
    .filter((x) => !x.ok)
);

// --- B: products list markup
await go(page, "#/products");
const cardHtml = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll("a[href*='/products/'], [data-slot='card'], article, li"));
  return els.slice(0, 4).map((e) => e.outerHTML.slice(0, 400));
});
const anchors = await page.evaluate(() =>
  Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")).filter((h) => h && !h.startsWith("http")).slice(0, 40)
);

report("Test 2b: banner image + products markup", { banner, brokenExternal: allExternal, cardHtml, anchors, consoleErrors: interesting(consoleErrors), pageErrors, badResponses });

await browser.close();
