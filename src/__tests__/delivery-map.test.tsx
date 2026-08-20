import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DeliveryMap } from "@/pages/admin/AdminOrders";

// Mock the geocodeAddress utility
vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn(),
}));

import { geocodeAddress } from "@/lib/geocode";
const mockGeocodeAddress = vi.mocked(geocodeAddress);

beforeEach(() => {
  mockGeocodeAddress.mockReset();
});

describe("DeliveryMap", () => {
  it("shows embedded map and Google Maps link when coords are provided", () => {
    render(
      <DeliveryMap latitude={19.076} longitude={72.8777} addressText="Mumbai" />
    );

    // OSM iframe should be present
    const iframe = document.querySelector("iframe[title='Delivery location map']");
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute("src")).toContain("openstreetmap.org");

    // Google Maps link
    const gmapLink = screen.getByText(/View Delivery Location on Map/);
    expect(gmapLink).toBeTruthy();
    expect(gmapLink.getAttribute("href")).toContain("google.com/maps?q=19.076,72.8777");

    // Coordinates displayed
    expect(screen.getByText(/Lat: 19\.076, Lng: 72\.8777/)).toBeTruthy();
  });

  it("geocodes address text when no coords provided", async () => {
    mockGeocodeAddress.mockResolvedValueOnce({
      latitude: 28.6139,
      longitude: 77.209,
      displayName: "New Delhi, India",
    });

    render(
      <DeliveryMap latitude={null} longitude={null} addressText="New Delhi" />
    );

    // Should have called geocodeAddress with the address text
    await waitFor(() => {
      expect(mockGeocodeAddress).toHaveBeenCalledWith("New Delhi");
    });

    // After geocoding, map should appear
    await waitFor(() => {
      const iframe = document.querySelector("iframe[title='Delivery location map']");
      expect(iframe).toBeTruthy();
    });

    // Google Maps link with geocoded coords
    await waitFor(() => {
      const link = screen.getByText(/View Delivery Location on Map/);
      expect(link.getAttribute("href")).toContain("google.com/maps?q=28.6139,77.209");
    });
  });

  it("shows address-based Google Maps link when geocoding fails", async () => {
    mockGeocodeAddress.mockResolvedValueOnce(null);

    render(
      <DeliveryMap
        latitude={null}
        longitude={null}
        addressText="Shop No. 12, Kalyan West, Mumbai, Maharashtra, 421301"
      />
    );

    await waitFor(() => {
      expect(mockGeocodeAddress).toHaveBeenCalled();
    });

    // Should show the fallback link (no embedded map)
    await waitFor(() => {
      const iframe = document.querySelector("iframe[title='Delivery location map']");
      expect(iframe).toBeNull();
    });

    // Fallback link using address text search
    const link = screen.getByText(/View Delivery Location on Map/);
    expect(link.getAttribute("href")).toContain("google.com/maps/search");
    expect(link.getAttribute("href")).toContain("Shop%20No.%2012");
  });

  it("does not geocode when coords are already provided", () => {
    render(
      <DeliveryMap latitude={12.97} longitude={77.59} addressText="Bangalore" />
    );

    // Should NOT have called geocodeAddress
    expect(mockGeocodeAddress).not.toHaveBeenCalled();
  });

  it("shows geocoding loading indicator while resolving", async () => {
    // Create a promise we control
    let resolveGeocode: (v: any) => void;
    mockGeocodeAddress.mockImplementationOnce(
      () => new Promise((resolve) => { resolveGeocode = resolve; })
    );

    render(
      <DeliveryMap latitude={null} longitude={null} addressText="Pune" />
    );

    // While loading, should show "Finding location on map..."
    expect(screen.getByText(/Finding location on map/)).toBeTruthy();

    // Resolve the geocode
    resolveGeocode!({ latitude: 18.52, longitude: 73.85, displayName: "Pune" });

    await waitFor(() => {
      expect(screen.getByText(/View Delivery Location on Map/)).toBeTruthy();
    });
  });
});
