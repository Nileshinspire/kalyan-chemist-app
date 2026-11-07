/**
 * Google Maps JavaScript API loader.
 *
 * The browser key is read from Vite's public env (`VITE_GOOGLE_MAPS_API_KEY`),
 * never hardcoded. A Maps JavaScript API key is public by design; it must be
 * restricted in Google Cloud to your HTTP referrers and to the Maps JavaScript
 * API. No server/secret key is used anywhere in this project.
 */

let loaderPromise: Promise<any> | null = null;

export function getGoogleMapsApiKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps is only available in the browser."));
  }
  const existingApi = (window as any).google;
  if (existingApi?.maps?.Map) return Promise.resolve(existingApi);

  const key = getGoogleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-kc-google-maps="true"]',
    );

    if (existingScript) {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if ((window as any).google?.maps?.Map) {
          window.clearInterval(timer);
          resolve((window as any).google);
        } else if (Date.now() - startedAt > 15000) {
          window.clearInterval(timer);
          loaderPromise = null;
          reject(new Error("Google Maps could not be loaded."));
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&loading=async&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.kcGoogleMaps = "true";
    script.onload = () => {
      if ((window as any).google?.maps?.Map) {
        resolve((window as any).google);
      } else {
        loaderPromise = null;
        reject(new Error("Google Maps could not be loaded."));
      }
    };
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
