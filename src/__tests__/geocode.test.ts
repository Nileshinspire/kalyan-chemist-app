import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocodeAddress } from "@/lib/geocode";

// Mock global fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("geocodeAddress", () => {
  it("returns null for empty string", async () => {
    const result = await geocodeAddress("");
    expect(result).toBeNull();
  });

  it("returns null for string shorter than 5 characters", async () => {
    const result = await geocodeAddress("abc");
    expect(result).toBeNull();
    // Should NOT have called fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns lat/lng for a valid Indian address", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: "19.0760",
          lon: "72.8777",
          display_name: "Mumbai, Maharashtra, India",
        },
      ],
    });

    const result = await geocodeAddress("Mumbai, Maharashtra, India");

    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(19.076);
    expect(result!.longitude).toBe(72.8777);
    expect(result!.displayName).toBe("Mumbai, Maharashtra, India");

    // Verify correct URL params
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("nominatim.openstreetmap.org/search");
    expect(calledUrl).toContain("countrycodes=in");
    expect(calledUrl).toContain("format=json");

    // Verify User-Agent header
    const calledInit = mockFetch.mock.calls[0][1];
    expect(calledInit.headers["User-Agent"]).toContain("KalyanChemist");
  });

  it("returns null when Nominatim returns empty results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const result = await geocodeAddress("xyznonexistent12345");
    expect(result).toBeNull();
  });

  it("returns null when API returns non-ok status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    const result = await geocodeAddress("Some valid address here");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await geocodeAddress("Some valid address here");
    expect(result).toBeNull();
  });

  it("rounds lat/lng to 6 decimal places", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: "28.61391234567",
          lon: "77.20901234567",
          display_name: "New Delhi, India",
        },
      ],
    });

    const result = await geocodeAddress("New Delhi, India");

    expect(result).not.toBeNull();
    // 28.61391234567 rounded to 6 decimals = 28.613912
    expect(result!.latitude).toBe(28.613912);
    // 77.20901234567 rounded to 6 decimals = 77.209012
    expect(result!.longitude).toBe(77.209012);
  });

  it("returns null when response has invalid lat/lon values", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: "invalid",
          lon: "also-invalid",
          display_name: "Nowhere",
        },
      ],
    });

    const result = await geocodeAddress("Some address");
    expect(result).toBeNull();
  });

  it("returns null when response JSON is not an array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "bad query" }),
    });

    const result = await geocodeAddress("Some address here");
    expect(result).toBeNull();
  });

  it("uses display_name from API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: "12.9716",
          lon: "77.5946",
          display_name: "Bangalore, Karnataka, India",
        },
      ],
    });

    const result = await geocodeAddress("Bangalore");
    expect(result!.displayName).toBe("Bangalore, Karnataka, India");
  });

  it("falls back to address text when display_name is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: "12.9716",
          lon: "77.5946",
          // no display_name
        },
      ],
    });

    const result = await geocodeAddress("Bangalore India");
    expect(result!.displayName).toBe("Bangalore India");
  });
});
