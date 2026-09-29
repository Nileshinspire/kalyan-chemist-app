import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto("https://sunny-baths-help.freebuff.dev/#/products/dolo-650", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const out = await p.evaluate(() => {
    const tables = Array.from(document.querySelectorAll("table")).map((t) => {
      const rows = Array.from(t.querySelectorAll("tbody tr")).map((r) =>
        Array.from(r.querySelectorAll("td")).map((td) => td.textContent?.trim().slice(0, 40))
      );
      const first = t.querySelector("tbody tr");
      const cells = first ? Array.from(first.querySelectorAll("td")).map((td) => Math.round(td.getBoundingClientRect().width)) : [];
      return { w: Math.round(t.getBoundingClientRect().width), cells, rows: rows.slice(0, 8) };
    });
    const imgs = Array.from(document.querySelectorAll("img"))
      .map((i) => ({ w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), alt: i.alt }))
      .filter((i) => i.w > 60);
    return { tables, imgs };
  });
  console.log(JSON.stringify(out, null, 1).slice(0, 3000));
  await b.close();
})();
