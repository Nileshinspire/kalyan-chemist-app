import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const fnName = (reference: unknown) =>
  (reference as Record<symbol, string> | undefined)?.[Symbol.for("functionName")];

const order = {
  _id: "order123",
  invoiceNumber: "INV-1001",
  userName: "Asha Verma",
  userEmail: "asha@example.com",
  userPhone: "9876500011",
  totalAmount: 64,
  subtotal: 60,
  discount: 0,
  tax: 0,
  deliveryFee: 4,
  shippingAddress: "12 MG Road, Pune 411001",
  phone: "9876500011",
  status: "out_for_delivery",
  paymentMethod: "cod",
  paymentStatus: "pending",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  trackingActive: false,
  items: [
    {
      productId: "p1",
      name: "Dolo 650",
      price: 32,
      quantity: 2,
      product: { name: "Dolo 650", prescriptionRequired: true },
    },
  ],
};

vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const name = fnName(query);
    if (name === "admin:listOrders") return [order];
    if (name === "admin:getOrderById") return order;
    if (name === "deliveryAdmin:listDeliveryBoys") return [];
    return undefined;
  },
  useMutation: () => vi.fn().mockResolvedValue({}),
  useAction: () => vi.fn().mockResolvedValue({}),
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn().mockResolvedValue(null),
}));

import AdminOrders from "@/pages/admin/AdminOrders";

const openSpy = vi.fn();

beforeEach(() => {
  openSpy.mockReset();
  openSpy.mockReturnValue({ opener: null });
  vi.stubGlobal("open", openSpy);
});

describe("Admin order WhatsApp actions", () => {
  it("opens the customer's chat with a pre-filled status message", () => {
    render(<AdminOrders />);

    // Open the order detail dialog
    fireEvent.click(screen.getByText("INV-1001"));

    fireEvent.click(screen.getByText("Message customer"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    // Addressed to the customer's own number, not the store number.
    expect(url.startsWith("https://wa.me/919876500011?text=")).toBe(true);

    const text = decodeURIComponent(url);
    expect(text).toContain("Hello Asha Verma");
    expect(text).toContain("#INV-1001");
    expect(text).toContain("out for delivery");
    expect(text).toContain("Dolo 650 × 2");
    // Status is "out_for_delivery", so no refund claim is present.
    expect(text).not.toContain("refund");
  });
});
