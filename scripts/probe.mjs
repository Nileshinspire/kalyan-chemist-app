const query = process.argv[2] || "Telma 40";
const url = `https://pharmeasy.in/search/all?name=${encodeURIComponent(query)}`;
const res = await fetch(url, {
  headers: {
    "user-agent": "KalyanChemist/1.0 (https://kalyanchemist.com; product image retrieval)",
    accept: "text/html,application/xhtml+xml",
  },
});
const html = await res.text();
const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
if (!m) { console.log("no next data", res.status); process.exit(0); }
const data = JSON.parse(m[1]);
const found = [];
const seen = new Set();
function walk(node, depth) {
  if (depth > 10 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const i of node) walk(i, depth + 1); return; }
  if (seen.has(node)) return;
  seen.add(node);
  if (typeof node.name === "string" && (node.image || node.damImages || node.slug)) found.push(node);
  for (const v of Object.values(node)) walk(v, depth + 1);
}
walk(data, 0);
for (const r of found) {
  const n = String(r.name);
  if (!/telma/i.test(n)) continue;
  console.log("RECORD:", n, "| mfr:", r.manufacturer, "| unit:", r.measurementUnit, "| sub:", r.subtitleText);
  for (const d of r.damImages || []) console.log("   face=", d.face, "|", String(d.url).split("/").pop());
  if (r.image) console.log("   single image:", String(r.image).split("/").pop());
}
console.log("matched records:", found.filter((r) => /telma/i.test(String(r.name))).length, "of", found.length);
