// Thin wrapper: serve dist in-browser only, then run the same existing QA
// scenarios the task already defines (bottom nav, filter sheet, mobile sort,
// sticky purchase bar, etc.). This command already exposes the DIST path and
// waits for the SPA to mount before running scenarios.
// Thin wrapper: spawn node on qa/local-interact.mjs directly, so the existing
// smoke test runs without any eval/module-coupling hacks in this harness.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const script = join(HERE, "local-interact.mjs");
if (!readFileSync(script, "utf8").includes("// Functional smoke test")) {
  console.error("local-interact.mjs missing smoke-test block — refresh interact-runner.mjs");
  process.exit(2);
}
const child = spawn(process.execPath, [script], {
  stdio: ["ignore", "inherit", "inherit"],
  timeout: 170000,
});
child.on("close", (code) => process.exit(code ?? 1));
child.on("error", () => process.exit(2));
