/**
 * Geocode a delivery address string into latitude/longitude using
 * the free Nominatim / OpenStreetMap API (no API key required).
 *
 * Usage policy: max 1 request/second, set a valid User-Agent.
 * See https://operations.osmfoundation.org/policies/nominatim/
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

/**
 * Convert a free-text delivery address into coordinates.
 * Returns `null` when the address cannot be resolved.
 */
export async function geocodeAddress(
  addressText: string,
): Promise<GeocodeResult | null> {
  if (!addressText || addressText.trim().length < 5) return null;

  try {
    const params = new URLSearchParams({
      q: addressText,
      format: "json",
      limit: "1",
      addressdetails: "1",
      countrycodes: "in", // India — adjust if needed
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          // Nominatim requires a descriptive User-Agent — identify the app
          "User-Agent": "KalyanChemist/1.0 (pharmacy-delivery)",
          // Accept-Language ensures results are in English
          "Accept-Language": "en",
        },
      },
    );

    if (!res.ok) return null;

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const best = results[0];
    const lat = parseFloat(best.lat);
    const lng = parseFloat(best.lon);

    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return {
      latitude: Math.round(lat * 1_000_000) / 1_000_000,
      longitude: Math.round(lng * 1_000_000) / 1_000_000,
      displayName: best.display_name ?? addressText,
    };
  } catch {
    // Network errors, CORS issues, etc. — non-fatal, just skip geocoding
    return null;
  }
}
