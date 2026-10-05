// Shared helpers for authenticated customer-side QA.
// Uses the app's OWN Convex Auth configuration (src/convex/auth.ts enables the
// Anonymous provider) to create a disposable session through the real auth
// backend — no production code is modified and no auth is bypassed.

export async function anonymousSignIn() {
  const BASE = "https://sunny-baths-help.freebuff.dev";
  const html = await (await fetch(BASE + "/")).text();
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  let convexUrl = null;
  for (const s of srcs) {
    const js = await (await fetch(new URL(s, BASE))).text();
    const m = js.match(/https:\/\/[a-z0-9-]+\.convex\.cloud/);
    if (m) { convexUrl = m[0]; break; }
  }
  if (!convexUrl) throw new Error("convex url not found in bundle");

  const res = await fetch(`${convexUrl}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "auth:signIn", args: { provider: "anonymous", params: {} } }),
  });
  const json = await res.json().catch(() => null);
  if (json?.status !== "success" || !json.value?.tokens) {
    throw new Error("sign-in failed: " + JSON.stringify(json).slice(0, 300));
  }
  const { token, refreshToken } = json.value.tokens;
  return { convexUrl, token, refreshToken, ns: convexUrl.replace(/[^a-zA-Z0-9]/g, "") };
}

export async function injectSession(page, session) {
  const { token, refreshToken, ns } = session;
  await page.evaluate(({ token, refreshToken, ns }) => {
    localStorage.setItem(`__convexAuthJWT_${ns}`, token);
    localStorage.setItem(`__convexAuthRefreshToken_${ns}`, refreshToken);
  }, { token, refreshToken, ns });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

export async function queryPublic(convexUrl, path, args = {}) {
  const res = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  return (await res.json().catch(() => null))?.value;
}

export const hash = (page) => {
  const h = page.url().split("#")[1] || "";
  return h || "/";
};

export const pageSummary = (page) =>
  page.evaluate(() => {
    const t = (s) => document.querySelector(s)?.innerText?.trim() || null;
    return {
      h1: [...document.querySelectorAll("h1")].map((e) => e.innerText.trim()).filter(Boolean).slice(0, 3),
      h2: [...document.querySelectorAll("h2")].map((e) => e.innerText.trim()).filter(Boolean).slice(0, 5),
      mainLen: (document.querySelector("main")?.innerText || "").replace(/\s+/g, " ").trim().length,
      mainHead: (document.querySelector("main")?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160),
      buttons: [...document.querySelectorAll("main button")].map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 12),
      inputs: [...document.querySelectorAll("main input, main select, main textarea")].map((e) => ({
        tag: e.tagName, type: e.type || "", name: e.name || "", value: e.value || "",
        placeholder: e.placeholder || "", label: (e.closest("label")?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
      })).slice(0, 14),
      bodyLen: document.body.innerText.length,
      breadcrumb: t("nav[aria-label='breadcrumb']") || [...document.querySelectorAll("nav")].map((n) => n.innerText.replace(/\s+/g, " ").trim()).find((x) => /Home/.test(x)) || null,
    };
  });
