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
  WHATSAPP_GREETING_MESSAGE,
  WHATSAPP_QUICK_REPLIES,
  generateAdminOrderMessage,
  generateAssistanceMessage,
  generateDirectChatMessage,
  generateProductMessage,
  generateQuickReply,
  openWhatsApp,
  whatsAppLinkFor,
} from "@/lib/whatsapp";
import WhatsAppFloat from "@/components/WhatsAppFloat";

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

  it("uses a distinct, exact message for each option", () => {
    expect(generateAssistanceMessage("medicine_enquiry")).toBe(
      [
        "👋 Hello Kalyan Chemist Team!",
        "",
        "I would like to enquire about a medicine. Could you please help me with its availability and price?",
        "",
        "Thank you!",
      ].join("\n")
    );

    expect(generateAssistanceMessage("prescription_help")).toBe(
      [
        "👋 Hello Kalyan Chemist Team!",
        "",
        "I need some assistance with my prescription. Could you please guide me?",
        "",
        "Thank you!",
      ].join("\n")
    );

    expect(generateAssistanceMessage("pharmacist")).toBe(
      [
        "👋 Hello Kalyan Chemist Team!",
        "",
        "I would like to speak with a pharmacist regarding a medicine.",
        "",
        "Could you please assist me?",
        "",
        "Thank you!",
      ].join("\n")
    );

    const messages = new Set(
      WHATSAPP_ASSISTANCE_OPTIONS.map((option) =>
        generateAssistanceMessage(option.id)
      )
    );
    expect(messages.size).toBe(4);
    expect([...messages].every((msg) => !msg.includes("website"))).toBe(true);
  });

  it("adds the Order ID only when the customer provided one", () => {
    expect(generateAssistanceMessage("order_support", "INV-1001")).toBe(
      [
        "👋 Hello Kalyan Chemist Team!",
        "",
        "I need an update regarding my order.",
        "",
        "Order ID: INV-1001",
        "",
        "Could you please help me with the current status?",
        "",
        "Thank you!",
      ].join("\n")
    );

    const withoutId = generateAssistanceMessage("order_support");
    expect(withoutId).toContain("I need an update regarding my order.");
    expect(withoutId).toContain("Could you please help me with the current status?");
    expect(withoutId).not.toContain("Order ID:");

    // A typed sentence with no order reference is not turned into an ID.
    const typedSentence = generateAssistanceMessage(
      "order_support",
      "my order is delayed"
    );
    expect(typedSentence).not.toContain("Order ID:");
  });
});

describe("Product enquiry message", () => {
  it("uses the customer enquiry format with real product data", () => {
    const msg = generateProductMessage({
      productName: "Dolo 650 Tablet",
      price: 32,
      productId: "SKU-123",
      manufacturer: "Micro Labs Ltd",
      packSize: "15 tablets",
      requestedQuantity: 2,
      productUrl: "https://kalyan.test/#/products/dolo-650",
      prescriptionRequired: true,
    });

    expect(msg.startsWith("👋 Hello Kalyan Chemist Team!\n\nI am interested in purchasing this medicine:\n\n💊 *Dolo 650 Tablet*"))
      .toBe(true);
    expect(msg).toContain("• Product ID: SKU-123");
    expect(msg).toContain("• Manufacturer: Micro Labs Ltd");
    expect(msg).toContain("• Pack Size: 15 tablets");
    expect(msg).toContain("• Quantity: 2");
    expect(msg).toContain("• Price: ₹32");
    expect(msg).toContain("🔗 Product Link: https://kalyan.test/#/products/dolo-650");
    expect(msg).toContain(
      "Could you please confirm its availability and guide me with the ordering process?"
    );
    expect(msg).toContain("⚠️ A valid prescription is required for this medicine.");
    expect(msg.trim().endsWith("Thank you!")).toBe(true);

    // No availability claim and no website footer.
    expect(msg).not.toMatch(/is available/i);
    expect(msg).not.toContain("website");
  });

  it("omits optional fields that the product does not have", () => {
    const msg = generateProductMessage({ productName: "Crocin", price: 20 });
    expect(msg).toContain("💊 *Crocin*");
    expect(msg).toContain("• Quantity: 1");
    expect(msg).toContain("• Price: ₹20");
    expect(msg).not.toContain("Product ID:");
    expect(msg).not.toContain("Manufacturer:");
    expect(msg).not.toContain("Pack Size:");
    expect(msg).not.toContain("Product Link:");
    expect(msg).not.toContain("prescription");
  });
});

describe("Admin WhatsApp Business quick replies", () => {
  it("ships all six templates with a shortcut", () => {
    expect(WHATSAPP_QUICK_REPLIES.map((t) => t.id)).toEqual([
      "medicine_enquiry",
      "product_order",
      "order_support",
      "prescription_help",
      "pharmacist",
      "medicine_unavailable",
    ]);
    for (const template of WHATSAPP_QUICK_REPLIES) {
      expect(template.shortcut.startsWith("/")).toBe(true);
    }
  });

  it("writes each reply in customer-support tone with real values only", () => {
    expect(generateQuickReply({ id: "medicine_enquiry" })).toBe(
      [
        "Hello! 👋",
        "",
        "Thank you for contacting Kalyan Chemist.",
        "",
        "Please share the medicine name so we can check its availability and price.",
        "",
        "We are happy to assist you!",
      ].join("\n")
    );

    // Product template: availability/price stay for the admin to verify.
    expect(
      generateQuickReply({ id: "product_order", productName: "Dolo 650" })
    ).toBe(
      [
        "Hello! 👋",
        "",
        "Thank you for your interest in *Dolo 650*.",
        "",
        "[Admin inserts verified availability and price information.]",
        "",
        "Would you like assistance with placing your order?",
      ].join("\n")
    );

    expect(
      generateQuickReply({
        id: "order_support",
        orderId: "INV-1001",
        orderStatus: "Out for delivery",
      })
    ).toContain("Your order *#INV-1001* is currently *Out for delivery*.");

    // Missing values stay visible placeholders — never guessed.
    expect(generateQuickReply({ id: "order_support" })).toContain(
      "Your order *#[Order ID]* is currently *[Verified Order Status]*."
    );

    expect(
      generateQuickReply({ id: "medicine_unavailable" })
    ).toContain("We are sorry, but the requested medicine is currently unavailable.");

    expect(generateQuickReply({ id: "prescription_help" })).toContain(
      "Please share a clear image of your prescription"
    );
    expect(generateQuickReply({ id: "pharmacist" })).toContain(
      "help connect you with the pharmacist"
    );
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

describe("Floating WhatsApp button", () => {
  it("opens the configured chat directly with the pre-filled greeting", () => {
    render(<WhatsAppFloat />);

    fireEvent.click(screen.getByLabelText("Chat on WhatsApp"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toBe(
      `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(
        generateDirectChatMessage()
      )}`
    );
    expect(decodeURIComponent(url)).toContain(
      "I would like to connect with your team for assistance regarding medicines or an order."
    );
    expect(openSpy.mock.calls[0][1]).toBe("_blank");
    expect(openSpy.mock.calls[0][2]).toContain("noopener");

    // No assistance panel is shown before the chat opens.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ships the WhatsApp Business greeting text for manual configuration", () => {
    expect(WHATSAPP_GREETING_MESSAGE.split("\n")).toEqual([
      "Hello! 👋",
      "",
      "Welcome to Kalyan Chemist.",
      "",
      "How can we assist you today?",
      "",
      "1. 💊 Order Medicines",
      "2. 📦 Existing Order Support",
      "3. 📄 Prescription Help",
      "4. 👨‍⚕️ Talk to Pharmacist",
      "",
      "Simply tell us your requirement, and our team will be happy to assist you.",
      "",
      "Thank you for contacting Kalyan Chemist!",
    ]);
  });
});
