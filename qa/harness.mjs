import { chromium } from "playwright-core";

export const BASE = "https://sunny-baths-help.freebuff.dev";

// Distinct exit code for "environment blocked" so an outage is never reported
// as an application failure.
export const EXIT_ENV_BLOCKED = 78;

/**
 * Preview-health precheck. Fail fast with a clear message when the preview is
 * unavailable (502/timeout), instead of letting every test fail later with a
 * misleading application-looking error such as "convex url not found in bundle".
 */
export async function assertPreview({ retries = 3, delayMs = 1500 } = {}) {
  let last = "no attempt";
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(BASE + "/", { signal: AbortSignal.timeout(12000) });
      if (res.ok) return true;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e?.message || String(e);
    }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  console.error(`\n[ENVIRONMENT BLOCKED] Preview is unavailable: ${BASE} → ${last}`);
  console.error("This is an environment/hosting problem, NOT an application failure.");
  console.error("No application checks were run. Re-run this test once the preview is healthy.\n");
  process.exit(EXIT_ENV_BLOCKED);
}

/** Fail fast with the same clear signal for tests that need a signed-in page. */
export async function assertPreviewOrExit() {
  return assertPreview();
}

export async function launch({ mobile = false } = {}) {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1440, height: 900 } }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") consoleErrors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("requestfailed", (r) => failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
  const badResponses = [];
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return { browser, context, page, consoleErrors, pageErrors, failedRequests, badResponses };
}

export async function go(page, hash) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
}

export function report(name, data) {
  console.log(`\n===== ${name} =====`);
  console.log(JSON.stringify(data, null, 2));
}

export const interesting = (arr) =>
  arr.filter(
    (t) =>
      !/favicon|manifest|apple-touch/i.test(t) &&
      !/Download the React DevTools/i.test(t)
  );
