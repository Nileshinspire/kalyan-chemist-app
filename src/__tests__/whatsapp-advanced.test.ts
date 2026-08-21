import { describe, it, expect } from "vitest";
import {
  generateProductMessage,
  generateCartMessage,
  generateOrderMessage,
  generateEnquiryMessage,
} from "../lib/whatsapp";

describe("WhatsApp Advanced Features", () => {
  // ══════════════════════════════════════════════════════
  //  PRESCRIPTION HANDLING
  // ══════════════════════════════════════════════════════
  describe("Prescription Warning", () => {
    it("adds Rx warning to product message when prescription required", () => {
      const msg = generateProductMessage({
        productName: "Amoxicillin 500mg",
        price: 120,
        prescriptionRequired: true,
        stockQuantity: 50,
        requestedQuantity: 1,
      });
      expect(msg).toContain("Prescription Required");
      expect(msg).toContain("registered medical practitioner");
    });

    it("does not add Rx warning for OTC products", () => {
      const msg = generateProductMessage({
        productName: "Paracetamol 500mg",
        price: 25,
        prescriptionRequired: false,
        stockQuantity: 100,
      });
      expect(msg).not.toContain("Prescription Required");
    });

    it("adds Rx warning to cart message when cart has prescription items", () => {
      const msg = generateCartMessage({
        products: [
          { name: "Amoxicillin", quantity: 1, price: 120, prescriptionRequired: true },
          { name: "Paracetamol", quantity: 2, price: 25, prescriptionRequired: false },
        ],
        subtotal: 170,
      });
      expect(msg).toContain("Prescription Required for:");
      // Amoxicillin is in the Rx section; Paracetamol only in the items list
      const rxSection = msg.split("Prescription Required for:")[1] || "";
      expect(rxSection).toContain("Amoxicillin");
      expect(rxSection).not.toContain("Paracetamol");
    });

    it("adds Rx warning to order message for prescription items", () => {
      const msg = generateOrderMessage({
        products: [
          { name: "Azithromycin", quantity: 3, price: 80, prescriptionRequired: true },
        ],
        subtotal: 240,
        deliveryFee: 0,
        tax: 29,
        total: 269,
      });
      expect(msg).toContain("Prescription Required for:");
      expect(msg).toContain("Azithromycin");
      expect(msg).toContain("valid prescription");
    });

    it("does not show Rx section when no items need prescription in cart", () => {
      const msg = generateCartMessage({
        products: [
          { name: "Vitamin C", quantity: 2, price: 100, prescriptionRequired: false },
        ],
        subtotal: 200,
      });
      expect(msg).not.toContain("Prescription Required");
    });
  });

  // ══════════════════════════════════════════════════════
  //  MULTI-PRODUCT QUANTITY
  // ══════════════════════════════════════════════════════
  describe("Multi-Product Quantity in Messages", () => {
    it("shows quantity in product message availability line", () => {
      const msg = generateProductMessage({
        productName: "Ibuprofen 400mg",
        price: 30,
        stockQuantity: 20,
        requestedQuantity: 5,
      });
      expect(msg).toContain("Qty: 5");
    });

    it("cart message shows multiple quantities per item", () => {
      const msg = generateCartMessage({
        products: [
          { name: "Drug A", quantity: 3, price: 50 },
          { name: "Drug B", quantity: 1, price: 30 },
        ],
        subtotal: 180,
      });
      expect(msg).toContain("Drug A × 3");
      expect(msg).toContain("Drug B × 1");
    });

    it("order message shows quantities", () => {
      const msg = generateOrderMessage({
        products: [
          { name: "Drug A", quantity: 3, price: 50 },
          { name: "Drug B", quantity: 2, price: 30 },
        ],
        subtotal: 210,
        deliveryFee: 0,
        tax: 25,
        total: 235,
      });
      expect(msg).toContain("Drug A × 3");
      expect(msg).toContain("Drug B × 2");
    });

    it("product availability correctly checks quantity vs stock", () => {
      // Available: stock 20 >= requested 10
      const msg1 = generateProductMessage({
        productName: "Test",
        price: 100,
        stockQuantity: 20,
        requestedQuantity: 10,
      });
      expect(msg1).toContain("available");

      // Unavailable: stock 5 < requested 10
      const msg2 = generateProductMessage({
        productName: "Test",
        price: 100,
        stockQuantity: 5,
        requestedQuantity: 10,
      });
      expect(msg2).toContain("unavailable");
    });
  });

  // ══════════════════════════════════════════════════════
  //  ORDER CONFIRMATION (admin → customer)
  // ══════════════════════════════════════════════════════
  describe("Order Confirmation Messages", () => {
    it("order message includes invoice number", () => {
      const msg = generateOrderMessage({
        invoiceNumber: "KC-2024-001",
        products: [{ name: "Paracetamol", quantity: 2, price: 25 }],
        subtotal: 50,
        deliveryFee: 0,
        tax: 6,
        total: 56,
      });
      expect(msg).toContain("KC-2024-001");
    });

    it("order message includes delivery address", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Test", quantity: 1, price: 100 }],
        subtotal: 100,
        deliveryFee: 0,
        tax: 12,
        total: 112,
        deliveryAddress: "Shop 12, Kalyan West, Mumbai",
      });
      expect(msg).toContain("Shop 12, Kalyan West, Mumbai");
    });

    it("order message includes coupon discount", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Test", quantity: 1, price: 200 }],
        subtotal: 200,
        couponDiscount: 20,
        deliveryFee: 0,
        tax: 22,
        total: 202,
      });
      expect(msg).toContain("Coupon Discount");
      expect(msg).toContain("-₹20");
    });
  });

  // ══════════════════════════════════════════════════════
  //  ENQUIRY MESSAGE
  // ══════════════════════════════════════════════════════
  describe("General Enquiry Message", () => {
    it("includes Kalyan Chemist branding", () => {
      const msg = generateEnquiryMessage({});
      expect(msg).toContain("Kalyan Chemist");
      expect(msg).toContain("Enquiry");
    });

    it("includes customer name when provided", () => {
      const msg = generateEnquiryMessage({ customerName: "Rahul" });
      expect(msg).toContain("Rahul");
    });
  });

  // ══════════════════════════════════════════════════════
  //  STOCK SAFETY (no stock deduction)
  // ══════════════════════════════════════════════════════
  describe("Stock Safety", () => {
    it("availability messages never mention stock deduction", () => {
      const msg = generateProductMessage({
        productName: "Drug",
        price: 100,
        stockQuantity: 50,
        requestedQuantity: 5,
      });
      expect(msg).not.toContain("deduct");
      expect(msg).not.toContain("reserved");
      expect(msg).not.toContain("removed from stock");
    });

    it("cart messages never mention stock operations", () => {
      const msg = generateCartMessage({
        products: [{ name: "Drug", quantity: 1, price: 100, stockQuantity: 10 }],
        subtotal: 100,
      });
      expect(msg).not.toContain("deduct");
      expect(msg).not.toContain("reserved");
    });
  });
});
