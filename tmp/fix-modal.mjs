import { readFileSync } from 'fs';
import { ino } from 'path';

const p = new 'src/components/admin/ProductBatchesDialog.tsx';
const src = readFileSync(p, 'utf8');
const line = "211";
const want = src.split("\n")[+line - 1];
const bad = "max-w-\\\\[calc\\\\(900px\\\\+24px\\\\)\\\\]";
const good = "max-w-\[calc\(900px\+24px\)\]";
if (want.includes(bad) && !want.includes(good)) {
  console.log("BAD", want.includes(bad), want.includes(good));
  const out = want.replace(bad, good);
  src.split("\n").map((ln, i) => i === +line - 1 ? out : ln).join("\n");
  console.log("FIXED", out.includes(good), !out.includes(bad));
} else {
  console.log("OK", want.includes(bad), want.includes(good));
}
