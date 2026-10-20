// Browser smoke check for the Message Center surfaces that do not require an
// admin session. Run with the project dev server already running.
//   node qa/message-center-smoke.mjs
import { chromium } from "playwright-core";
import os from "os";
import path from "path";

const BASE = process.env.MC_BASE || "http://localhost:5173";
const executablePath =
  process.env.CHROME_PATH ||
  path.join(
    os.homedir(),
    ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"
  );

const browser = await chromium.launch({ executablePath, headless: true });
const EXIT_ENV_BLOCKED = 78;
let failures = 0;

// Fail fast with an explicit environment signal when the backend is down, so a
// disabled deployment is never reported as a Message Center UI failure.
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  if (/deployment has been disabled|usage limit/i.test(body)) {
    console.error("\n[ENVIRONMENT BLOCKED] The Convex deployment is disabled:");
    console.error(body.slice(0, 400));
    console.error("Fix the deployment usage limit, then re-run this check.\n");
    await browser.close();
    process.exit(EXIT_ENV_BLOCKED);
  }
  await page.close();
}

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      // The deployment may be disabled; backend config errors are not UI failures.
      if (!/convex|usage limit|WebSocket|Failed to fetch|ERR_/i.test(text)) {
        errors.push(`console: ${text}`);
      }
    }
  });
  return errors;
}

async function visit(path, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = await collectErrors(page);
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  return { page, errors };
}

// ── 1. Storefront still renders with the new popup/bell mounted globally ──
{
  const { page, errors } = await visit("/", { width: 1366, height: 900 });
  const text = await page.locator("body").innerText();
  check("home renders", text.length > 500, `body text length ${text.length}`);
  check(
    "no Vite/React runtime overlay",
    (await page.locator("vite-error-overlay").count()) === 0
  );
  check("no frontend runtime errors", errors.length === 0, errors.join(" | "));
  await page.screenshot({ path: "qa/mc-home-desktop.png", fullPage: false });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  const mobileErrors = await collectErrors(mobile);
  await mobile.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await mobile.waitForTimeout(2500);
  check(
    "home renders on mobile",
    (await mobile.locator("body").innerText()).length > 400
  );
  check(
    "no mobile frontend runtime errors",
    mobileErrors.length === 0,
    mobileErrors.join(" | ")
  );
  await mobile.screenshot({ path: "qa/mc-home-mobile.png" });
  await mobile.close();
  await page.close();
}

// ── 2. Admin route stays protected for signed-out visitors ──
{
  const { page, errors } = await visit("/#/admin/messages", {
    width: 1366,
    height: 900,
  });
  await page.waitForTimeout(2500);
  const url = page.url();
  const body = await page.locator("body").innerText();
  check(
    "admin Message Center redirects a signed-out visitor",
    /\/auth|\/admin\/login/.test(url) || /sign in|access denied/i.test(body),
    `url=${url}`
  );
  check("admin redirect has no frontend errors", errors.length === 0, errors.join(" | "));
  await page.close();
}

// ── 3. Unsubscribe page renders in every state without crashing ──
{
  const { page, errors } = await visit("/#/unsubscribe?token=not-a-real-token", {
    width: 390,
    height: 844,
  });
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  check(
    "unsubscribe page renders a clear state",
    /unsubscribe|not valid|updating/i.test(body),
    body.slice(0, 160)
  );
  check("unsubscribe has no frontend errors", errors.length === 0, errors.join(" | "));
  await page.screenshot({ path: "qa/mc-unsubscribe-mobile.png" });
  await page.close();
}

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Message Center smoke checks passed");
