import { describe, it, expect } from "vitest";
import {
  generateOrderMessage,
  generateCartMessage,
  generateProductMessage,
  openWhatsApp,
} from "@/lib/whatsapp";

describe("WhatsApp utilities", () => {
  describe("generateOrderMessage", () => {
    it("includes product items with quantities", () => {
      const msg = generateOrderMessage({
        products: [
          { name: "Paracetamol 500mg", quantity: 2, price: 50 },
          { name: "Vitamin C", quantity: 1, price: 120 },
        ],
        subtotal: 220,
        deliveryFee: 0,
        tax: 26,
        total: 246,
      });
      expect(msg).toContain("Paracetamol 500mg × 2");
      expect(msg).toContain("Vitamin C × 1");
      expect(msg).toContain("₹100");
      expect(msg).toContain("₹120");
    });

    it("shows coupon discount when provided", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Ibuprofen", quantity: 1, price: 80 }],
        subtotal: 80,
        couponDiscount: 20,
        deliveryFee: 0,
        tax: 7,
        total: 67,
      });
      expect(msg).toContain("Coupon Discount");
      expect(msg).toContain("-₹20");
    });

    it("does not include coupon section when no discount", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Ibuprofen", quantity: 1, price: 80 }],
        subtotal: 80,
        deliveryFee: 0,
        tax: 10,
        total: 90,
      });
      expect(msg).not.toContain("Coupon Discount");
    });

    it("shows free delivery", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Test", quantity: 1, price: 500 }],
        subtotal: 500,
        deliveryFee: 0,
        tax: 60,
        total: 560,
      });
      expect(msg).toContain("Delivery: Free");
    });

    it("shows paid delivery fee", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Test", quantity: 1, price: 100 }],
        subtotal: 100,
        deliveryFee: 49,
        tax: 12,
        total: 161,
      });
      expect(msg).toContain("Delivery: ₹49");
    });

    it("includes delivery address when provided", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Test", quantity: 1, price: 100 }],
        subtotal: 100,
        deliveryFee: 49,
        tax: 12,
        total: 161,
        deliveryAddress: "123 Main St, Mumbai",
      });
      expect(msg).toContain("123 Main St, Mumbai");
    });

    it("includes invoice number when provided", () => {
      const msg = generateOrderMessage({
        orderId: "abc123",
        invoiceNumber: "KC-00001",
        products: [{ name: "Test", quantity: 1, price: 100 }],
        subtotal: 100,
        deliveryFee: 0,
        tax: 12,
        total: 112,
      });
      expect(msg).toContain("KC-00001");
    });

    it("does not include prescription/doctor/patient info", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Paracetamol", quantity: 1, price: 50 }],
        subtotal: 50,
        deliveryFee: 0,
        tax: 6,
        total: 56,
      });
      expect(msg).not.toMatch(/prescription/i);
      expect(msg).not.toMatch(/doctor/i);
      expect(msg).not.toMatch(/patient/i);
    });

    it("formats currency in Indian style", () => {
      const msg = generateOrderMessage({
        products: [{ name: "Test", quantity: 1, price: 1000 }],
        subtotal: 1000,
        deliveryFee: 0,
        tax: 120,
        total: 1120,
      });
      expect(msg).toContain("₹1,000");
      expect(msg).toContain("₹1,120");
    });
  });

  describe("generateCartMessage", () => {
    it("lists all cart items", () => {
      const msg = generateCartMessage({
        products: [
          { name: "Product A", quantity: 2, price: 100 },
          { name: "Product B", quantity: 1, price: 250 },
        ],
        subtotal: 450,
      });
      expect(msg).toContain("Product A × 2");
      expect(msg).toContain("Product B × 1");
      expect(msg).toContain("₹450");
    });

    it("does not include sensitive Rx information", () => {
      const msg = generateCartMessage({
        products: [{ name: "Morphine", quantity: 1, price: 500 }],
        subtotal: 500,
      });
      expect(msg).not.toMatch(/prescription/i);
      expect(msg).not.toMatch(/controlled/i);
    });
  });

  describe("generateProductMessage", () => {
    it("includes product name and price", () => {
      const msg = generateProductMessage({
        productName: "Crocin Advance",
        price: 30,
      });
      expect(msg).toContain("Crocin Advance");
      expect(msg).toContain("₹30");
    });

    it("includes composition when provided", () => {
      const msg = generateProductMessage({
        productName: "Test",
        price: 100,
        composition: "Paracetamol 500mg",
      });
      expect(msg).toContain("Paracetamol 500mg");
    });

    it("includes pack size when provided", () => {
      const msg = generateProductMessage({
        productName: "Test",
        price: 100,
        packSize: "1 strip of 10 tablets",
      });
      expect(msg).toContain("1 strip of 10 tablets");
    });

    it("omits optional fields when not provided", () => {
      const msg = generateProductMessage({
        productName: "Test",
        price: 100,
      });
      expect(msg).not.toContain("Composition:");
      expect(msg).not.toContain("Pack Size:");
    });
  });
});
