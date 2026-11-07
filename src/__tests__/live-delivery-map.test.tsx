import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/googleMaps", () => ({
  getGoogleMapsApiKey: () => undefined,
  loadGoogleMaps: vi.fn(),
}));

import { LiveDeliveryMap } from "@/components/tracking/LiveDeliveryMap";

describe("LiveDeliveryMap", () => {
  it("shows a waiting state until GPS coordinates arrive", () => {
    render(<LiveDeliveryMap latitude={null} longitude={null} />);
    expect(screen.getByText(/Waiting for the delivery partner's GPS/i)).toBeTruthy();
  });

  it("degrades gracefully when the Google Maps key is not configured", () => {
    render(<LiveDeliveryMap latitude={19.076} longitude={72.8777} />);
    expect(screen.getByText("Live map unavailable")).toBeTruthy();
    const link = screen.getByRole("link", { name: /open latest location/i });
    expect(link.getAttribute("href")).toBe("https://www.google.com/maps?q=19.076,72.8777");
  });
});
