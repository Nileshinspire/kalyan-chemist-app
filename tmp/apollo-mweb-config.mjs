// One-off: dump the Apollo mweb home screen section list from the JSON embedded
// in the HTML. The config is embedded as a backslash-escaped JSON string inside
// a Next.js script chunk, so we locate the balanced object that contains the
// config marker, unescape repeatedly, then pretty-print the section outline.
import { writeFileSync } from "node:fs";

const BASE = "https://www.apollopharmacy.in/";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const res = await fetch(BASE, {
  headers: { "user-agent": UA, accept: "*/*" },
  signal: AbortSignal.timeout(25000),
});
const html = await res.text();
writeFileSync("tmp/apollo-home.raw.html", html);
console.log("downloaded bytes:", html.length);

const markerSeq = `\\"__typename\\":\\"ContentfulScreenConfigurationType\\"`;
const markerIdx = html.indexOf(markerSeq);
console.log("marker index:", markerIdx);
if (markerIdx < 0) {
  console.log("config marker not found");
  process.exit(0);
}

// Find the nearest balanced { … } object that contains the marker.
function findOuterObject(html, markerIndex) {
  // Candidate opening braces to the left of the marker.
  const opens = [];
  for (let p = markerIndex; p >= 0; p--) {
    if (html[p] === "{") opens.push(p);
  }
  // Prefer the shallowest opening brace whose balanced close is after marker.
  for (const start of opens) {
    let d = 0;
    let end = -1;
    for (let p = start; p < html.length; p++) {
      const ch = html[p];
      if (ch === "{") d++;
      else if (ch === "}") {
        d--;
        if (d === 0) { end = p; break; }
      }
    }
    if (end > markerIndex) return [start, end];
  }
  // Fallback: the deepest opening brace before the marker.
  const deepest = opens[opens.length - 1];
  let d = 0;
  let end = -1;
  for (let p = deepest; p < html.length; p++) {
    const ch = html[p];
    if (ch === "{") d++;
    else if (ch === "}") {
      d--;
      if (d === 0) { end = p; break; }
    }
  }
  return [deepest, end];
}

const [start, end] = findOuterObject(html, markerIdx);
console.log("start:", start, "end:", end, "length:", end - start + 1);
const raw = html.slice(start, end + 1);
console.log("raw first 120 chars:", JSON.stringify(raw.slice(0, 120)));

function unescapeMany(s, maxPasses = 6) {
  let cur = s;
  for (let i = 0; i < maxPasses; i++) {
    const next = cur.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (next === cur) return cur;
    cur = next;
  }
  return cur;
}

let cfg = null;
for (const variant of [raw, unescapeMany(raw)]) {
  try { cfg = JSON.parse(variant); break; }
  catch {}
  // Some pages double-unescape; try a second pass.
  try { cfg = JSON.parse(unescapeMany(unescapeMany(variant))); break; }
  catch {}
}
if (!cfg) {
  console.log("could not parse config JSON from chunk");
  process.exit(0);
}

console.log("parsed OK, top type:", cfg?.type, "top keys:", Object.keys(cfg).slice(0, 8));

function walk(node, depth = 0) {
  if (!node || typeof node !== "object") return;
  const t = node.type;
  const title = node.section_title ?? node.section_heading;
  if (t) {
    console.log(
      "  ".repeat(depth) +
        (t === node.section_type ? t : `${t} (${node.section_type})`) +
        (title ? ` — ${title}` : "")
    );
  }
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) {
      for (const item of v) walk(item, depth + 1);
    } else if (v && typeof v === "object") {
      walk(v, depth + 1);
    }
  }
}

walk(cfg);
