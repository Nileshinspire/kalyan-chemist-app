/**
 * Razorpay Checkout loader.
 *
 * The Razorpay widget script used to be loaded synchronously from `index.html`,
 * which blocked HTML parsing and first paint on every page of the app — even for
 * visitors who never reach checkout. It is now injected on demand (and warmed up
 * on the checkout page) so the initial page load stays fast.
 *
 * The loader is idempotent: concurrent callers share one in-flight promise and
 * an already-present `<script>` is reused instead of duplicated.
 */

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const LOAD_TIMEOUT_MS = 15000;

let inFlight: Promise<boolean> | null = null;

/** Resolves `true` once `window.Razorpay` is available, `false` if it cannot load. */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) return Promise.resolve(true);
  if (inFlight) return inFlight;

  inFlight = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      // Allow a later retry if the script failed to load this time.
      if (!ok) inFlight = null;
      resolve(ok);
    };

    const timer = window.setTimeout(
      () => finish(Boolean(window.Razorpay)),
      LOAD_TIMEOUT_MS
    );

    const attach = (script: HTMLScriptElement) => {
      script.addEventListener("load", () => finish(true), { once: true });
      script.addEventListener("error", () => finish(false), { once: true });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SRC}"]`
    );

    if (existing) {
      attach(existing);
      // The tag may have finished loading before we attached our listeners.
      if (window.Razorpay) finish(true);
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SRC;
    script.async = true;
    attach(script);
    document.head.appendChild(script);
  });

  return inFlight;
}
