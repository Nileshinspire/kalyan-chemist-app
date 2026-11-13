import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  WHATSAPP_BUSINESS_NUMBER,
  buildWhatsAppUrl,
  normalizeWhatsAppNumber,
} from "@/lib/whatsappConfig";
import {
  ADMIN_WHATSAPP_TEMPLATES,
  WHATSAPP_ASSISTANCE_OPTIONS,
  generateAdminOrderMessage,
  generateAssistanceMessage,
  generateProductMessage,
  openWhatsApp,
  whatsAppLinkFor,
} from "@/lib/whatsapp";

const openSpy = vi.fn();

beforeEach(() => {
  openSpy.mockReset();
  vi.stubGlobal("open", openSpy);
});

describe("WhatsApp configuration", () => {
  it("uses the configured business number in digits-only form", () => {
    expect(WHATSAPP_BUSINESS_NUMBER).toBe("919334970699");
    expect(normalizeWhatsAppNumber("+91 93349 70699")).toBe("919334970699");
    expect(normalizeWhatsAppNumber("093349 70699")).toBe("919334970699");
    expect(normalizeWhatsAppNumber("9334970699")).toBe("919334970699");
  });

  it("builds an official click-to-chat URL with an encoded message", () => {
    const url = buildWhatsAppUrl("Hello & welcome", WHATSAPP_BUSINESS_NUMBER);
    expect(url.startsWith("https://wa.me/919334970699?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("Hello & welcome"));
    expect(url).not.toContain(" ");
  });

  it("never builds a link for an empty message", () => {
    expect(buildWhatsAppUrl("   ")).toBe("");
    expect(whatsAppLinkFor(WHATSAPP_BUSINESS_NUMBER, "")).toBe("");
  });

  it("falls back to the store number when the target number is missing", () => {
    expect(buildWhatsAppUrl("Hi", "")).toBe(
      `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent("Hi")}`
    );
  });

  it("opens WhatsApp in a new tab and does nothing for an empty message", () => {
    openWhatsApp("9334970699", "Test message");
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toContain("https://wa.me/919334970699?text=");
    expect(openSpy.mock.calls[0][1]).toBe("_blank");

    openSpy.mockReset();
    openWhatsApp("9334970699", "");
    expect(openSpy).not.toHaveBeenCalled();
  });
});

describe("Customer assistance messages", () => {
  it("exposes the four assistance options", () => {
    expect(WHATSAPP_ASSISTANCE_OPTIONS.map((o) => o.id)).toEqual([
      "medicine_enquiry",
      "order_support",
      "prescription_help",
      "pharmacist",
    ]);
  });

  it("pre-fills a professional message per option, including typed details", () => {
    for (const option of WHATSAPP_ASSISTANCE_OPTIONS) {
      const msg = generateAssistanceMessage(option.id, "Dolo 650 availability");
      expect(msg.length).toBeGreaterThan(20);
      expect(msg).toContain("Kalyan Chemist");
      expect(msg).toContain("Dolo 650 availability");
    }
    expect(generateAssistanceMessage("prescription_help")).toContain(
      "valid prescription"
    );
  });
});

describe("Product enquiry message", () => {
  it("includes only the real product data provided", () => {
    const msg = generateProductMessage({
      productName: "Dolo 650 Tablet",
      price: 32,
      productId: "SKU-123",
      brand: "Micro Labs",
      manufacturer: "Micro Labs Ltd",
      strength: "650 mg",
      packSize: "15 tablets",
      requestedQuantity: 2,
      productUrl: "https://kalyan.test/#/products/dolo-650",
      prescriptionRequired: true,
    });

    expect(msg).toContain("Product: Dolo 650 Tablet");
    expect(msg).toContain("Product ID: SKU-123");
    expect(msg).toContain("Brand: Micro Labs");
    expect(msg).toContain("Manufacturer: Micro Labs Ltd");
    expect(msg).toContain("Strength: 650 mg");
    expect(msg).toContain("Pack Size: 15 tablets");
    expect(msg).toContain("Quantity: 2");
    expect(msg).toContain("₹32");
    expect(msg).toContain("https://kalyan.test/#/products/dolo-650");
    expect(msg).toContain("Prescription Required");
  });

  it("does not invent missing details", () => {
    const msg = generateProductMessage({ productName: "Crocin", price: 20 });
    expect(msg).toContain("Product: Crocin");
    expect(msg).not.toContain("Product ID:");
    expect(msg).not.toContain("Brand:");
    expect(msg).not.toContain("Manufacturer:");
    expect(msg).not.toContain("Link:");
    expect(msg).not.toContain("Prescription Required");
  });
});

describe("Admin order messages", () => {
  const order = {
    customerName: "Asha",
    orderId: "INV-1001",
    status: "out_for_delivery",
    items: [{ name: "Dolo 650", quantity: 2, price: 32 }],
    total: 64,
    paymentStatus: "paid",
  };

  it("offers status templates and gates refunds on real data", () => {
    expect(ADMIN_WHATSAPP_TEMPLATES.map((t) => t.id)).toContain("order_packed");
    const refund = ADMIN_WHATSAPP_TEMPLATES.find((t) => t.id === "refund_processed");
    expect(refund?.requiresRefundedOrder).toBe(true);
  });

  it("writes the customer-facing message from the actual order status", () => {
    const msg = generateAdminOrderMessage({ order });
    expect(msg).toContain("Hello Asha");
    expect(msg).toContain("out for delivery");
    expect(msg).toContain("#INV-1001");
    expect(msg).toContain("Dolo 650 × 2");
    expect(msg).toContain("₹64");
  });

  it("never claims a refund was processed without refunded order data", () => {
    const unrefunded = generateAdminOrderMessage({
      template: "refund_processed",
      order,
    });
    expect(unrefunded).not.toContain("refund has been processed");

    const refunded = generateAdminOrderMessage({
      template: "refund_processed",
      order: { ...order, status: "refunded", paymentStatus: "refunded" },
    });
    expect(refunded).toContain("refund has been processed");
  });

  it("asks for a prescription when the order has none on record", () => {
    const msg = generateAdminOrderMessage({
      template: "prescription_clarification",
      order: { ...order, hasPrescription: false },
    });
    expect(msg).toContain("valid prescription");
  });
});

describe("Floating WhatsApp assistance panel", () => {
  it("opens the panel and each option opens WhatsApp with the store number", async () => {
    vi.resetModules();
    vi.doMock("framer-motion", async () => {
      const actual = await vi.importActual<Record<string, unknown>>("framer-motion");
      return {
        ...actual,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        motion: new Proxy(
          {},
          {
            get: (_target, key) =>
              ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
                // Drop motion-only props so jsdom does not warn about them.
                const domProps: Record<string, unknown> = {};
                for (const [prop, value] of Object.entries(props)) {
                  if (["initial", "animate", "exit", "transition", "variants", "whileHover", "whileTap"].includes(prop)) continue;
                  domProps[prop] = value;
                }
                const Tag = (
                  typeof key === "string" ? key : "div"
                ) as React.ElementType;
                return <Tag {...domProps}>{children}</Tag>;
              },
          }
        ),
      };
    });

    const { default: WhatsAppFloat } = await import("@/components/WhatsAppFloat");
    render(<WhatsAppFloat />);

    fireEvent.click(screen.getByLabelText("Chat on WhatsApp"));
    expect(screen.getByRole("dialog", { name: "WhatsApp assistance" })).toBeTruthy();

    fireEvent.change(
      screen.getByPlaceholderText("e.g. Dolo 650 availability"),
      { target: { value: "Need 2 strips" } }
    );

    fireEvent.click(screen.getByText("Medicine Enquiry"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url.startsWith(`https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=`)).toBe(true);
    expect(decodeURIComponent(url)).toContain("Medicine Enquiry");
    expect(decodeURIComponent(url)).toContain("Need 2 strips");
    expect(openSpy.mock.calls[0][2]).toContain("noopener");

    vi.doUnmock("framer-motion");
  });
});
