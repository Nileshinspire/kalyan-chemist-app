import { globSync } from "glob";
const files = globSync("src/__tests__/**/*.test.{ts,tsx}", { cwd: process.cwd() });
console.log("MATCHING TEST FILES:", files.length);
for (const f of files) console.log("  " + f);
