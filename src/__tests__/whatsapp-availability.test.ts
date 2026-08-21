import { describe, it, expect } from "vitest";
import {
  generateProductMessage,
  generateCartMessage,
  generateOrderMessage,
} from "../lib/whatsapp";

describe("WhatsApp Availability Auto-Reply", () => {
  describe("Product message - availability", () => {
    it("shows available message when stock >= requested quantity", () => {
      const msg = generateProductMessage({
        productName: "Paracetamol 500mg",
        price: 25,
        stockQuantity: 50,
        requestedQuantity: 2,
      });
      expect(msg).toContain("available at Kalyan Chemist");
      expect(msg).toContain("Our team will assist you shortly");
    });

    it("shows unavailable message when stock < requested quantity", () => {
      const msg = generateProductMessage({
        productName: "Paracetamol 500mg",
        price: 25,
        stockQuantity: 1,
        requestedQuantity: 5,
      });
      expect(msg).toContain("currently unavailable");
      expect(msg).toContain("alternative");
    });

    it("shows available when stock is exactly equal to requested quantity", () => {
      const msg = generateProductMessage({
        productName: "Ibuprofen 400mg",
        price: 30,
        stockQuantity: 3,
        requestedQuantity: 3,
      });
      expect(msg).toContain("available at Kalyan Chemist");
    });

    it("shows unavailable when stock is 0", () => {
      const msg = generateProductMessage({
        productName: "Amoxicillin 250mg",
        price: 120,
        stockQuantity: 0,
        requestedQuantity: 1,
      });
      expect(msg).toContain("currently unavailable");
    });

    it("defaults to quantity 1 when requestedQuantity not provided", () => {
      const msg = generateProductMessage({
        productName: "Cetirizine 10mg",
        price: 15,
        stockQuantity: 10,
      });
      expect(msg).toContain("available at Kalyan Chemist");
    });

    it("shows unavailable when stock undefined and defaults to 0", () => {
      const msg = generateProductMessage({
        productName: "Unknown Drug",
        price: 50,
      });
      expect(msg).toContain("currently unavailable");
    });

    it("does not affect stock - only checks, does not deduct", () => {
      const msg = generateProductMessage({
        productName: "Test Medicine",
        price: 100,
        stockQuantity: 5,
        requestedQuantity: 5,
      });
      // Message should only contain availability info, not stock operations
      expect(msg).not.toContain("deduct");
      expect(msg).not.toContain("reserved");
      expect(msg).not.toContain("cart added");
    });
  });

  describe("Cart message - availability", () => {
    it("shows all available when all items have sufficient stock", () => {
      const msg = generateCartMessage({
        products: [
          { name: "Paracetamol", quantity: 2, price: 25, stockQuantity: 50 },
          { name: "Ibuprofen", quantity: 1, price: 30, stockQuantity: 20 },
        ],
        subtotal: 80,
      });
      expect(msg).toContain("All items in your cart are available");
      expect(msg).not.toContain("unavailable");
    });

    it("shows unavailable items when some have insufficient stock", () => {
      const msg = generateCartMessage({
        products: [
          { name: "Paracetamol", quantity: 2, price: 25, stockQuantity: 50 },
          { name: "Ibuprofen", quantity: 5, price: 30, stockQuantity: 2 },
        ],
        subtotal: 200,
      });
      expect(msg).toContain("some items in your cart may be currently unavailable");
      expect(msg).toContain("Ibuprofen");
    });

    it("lists all unavailable items when multiple are out of stock", () => {
      const msg = generateCartMessage({
        products: [
          { name: "Drug A", quantity: 10, price: 50, stockQuantity: 2 },
          { name: "Drug B", quantity: 5, price: 30, stockQuantity: 0 },
          { name: "Drug C", quantity: 1, price: 20, stockQuantity: 100 },
        ],
        subtotal: 670,
      });
      expect(msg).toContain("Drug A");
      expect(msg).toContain("Drug B");
      // Drug C is in the items list but NOT in the unavailable section
      const unavailableSection = msg.split("some items")[1] || "";
      expect(unavailableSection).toContain("Drug A");
      expect(unavailableSection).toContain("Drug B");
      expect(unavailableSection).not.toContain("Drug C");
    });

    it("does not break when stockQuantity is undefined (backwards compat)", () => {
      const msg = generateCartMessage({
        products: [
          { name: "Old Product", quantity: 1, price: 100 },
        ],
        subtotal: 100,
      });
      // No stockQuantity means no availability check = shows available
      expect(msg).toContain("All items in your cart are available");
    });
  });

  describe("Order message - no availability (for confirmed orders)", () => {
    it("does not include availability auto-reply for confirmed orders", () => {
      const msg = generateOrderMessage({
        products: [
          { name: "Paracetamol", quantity: 2, price: 25 },
        ],
        subtotal: 50,
        deliveryFee: 0,
        tax: 6,
        total: 56,
      });
      expect(msg).not.toContain("available at Kalyan Chemist");
      expect(msg).not.toContain("currently unavailable");
      expect(msg).toContain("Please confirm availability and delivery time");
    });
  });
});

describe("WhatsApp Order Type Classification", () => {
  it("product message header says Product Inquiry (not Cart Inquiry)", () => {
    const msg = generateProductMessage({
      productName: "Test",
      price: 100,
    });
    expect(msg).toContain("Product Inquiry");
    expect(msg).not.toContain("Cart Inquiry");
  });

  it("cart message header says Cart Order (not Cart Inquiry)", () => {
    const msg = generateCartMessage({
      products: [{ name: "Test", quantity: 1, price: 100 }],
      subtotal: 100,
    });
    expect(msg).toContain("Cart Order");
    expect(msg).not.toContain("Cart Inquiry");
  });

  it("order message header says Order Request", () => {
    const msg = generateOrderMessage({
      products: [{ name: "Test", quantity: 1, price: 100 }],
      subtotal: 100,
      deliveryFee: 0,
      tax: 12,
      total: 112,
    });
    expect(msg).toContain("Order Request");
  });
});
