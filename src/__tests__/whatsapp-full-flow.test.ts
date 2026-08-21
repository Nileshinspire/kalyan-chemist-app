import { describe, it, expect } from "vitest";
import {
  detectIntent,
  formatGreetingMessage,
  formatAddressRequestMessage,
  formatIncompleteAddressMessage,
  formatQuantityRequestMessage,
  formatAvailabilityMessage,
  formatOrderSummaryMessage,
  formatConfirmationMessage,
  formatDeclineMessage,
  isPositiveResponse,
  isNegativeResponse,
  type MessageIntent,
} from "../lib/whatsappParser";

// ══════════════════════════════════════════════════════
//  FULL CONVERSATIONAL FLOW TESTS
// ══════════════════════════════════════════════════════

describe("Full WhatsApp Conversational Flow", () => {
  describe("Step 1: Greeting", () => {
    it("detects greeting intent", () => {
      const result = detectIntent("Hi");
      expect(result.type).toBe("greeting");
    });

    it("detects namaste greeting", () => {
      const result = detectIntent("Namaste");
      expect(result.type).toBe("greeting");
    });

    it("formats greeting message with welcome text", () => {
      const msg = formatGreetingMessage();
      expect(msg).toContain("Kalyan Chemist");
      expect(msg).toContain("prescription");
      expect(msg).toContain("medicine");
    });
  });

  describe("Step 2: Medicine Request", () => {
    it("detects simple medicine name", () => {
      const result = detectIntent("Dolo");
      expect(result.type).toBe("medicine_request");
      if (result.type === "medicine_request") {
        expect(result.medicine).toBe("dolo");
        expect(result.quantity).toBe(1);
      }
    });

    it("detects medicine with quantity prefix", () => {
      const result = detectIntent("need 2 paracetamol");
      expect(result.type).toBe("medicine_request");
      if (result.type === "medicine_request") {
        expect(result.medicine).toBe("paracetamol");
        expect(result.quantity).toBe(2);
      }
    });

    it("detects multiple medicines", () => {
      const result = detectIntent("Dolo and Crocin");
      expect(result.type).toBe("medicine_request");
      if (result.type === "medicine_request") {
        expect(result.multiple).toBe(true);
        expect(result.allMedicines).toContain("dolo");
        expect(result.allMedicines).toContain("crocin");
      }
    });

    it("formats address request after medicine found", () => {
      const msg = formatAddressRequestMessage({
        productName: "Dolo 650",
        quantity: 2,
      });
      expect(msg).toContain("Dolo 650");
      expect(msg).toContain("delivery address");
      expect(msg).toContain("Pincode");
    });

    it("formats address request for multiple medicines", () => {
      const msg = formatAddressRequestMessage({
        productName: "Dolo",
        quantity: 1,
        multiple: true,
        allMedicines: ["Dolo 650", "Crocin"],
      });
      expect(msg).toContain("Dolo 650, Crocin");
      expect(msg).toContain("delivery address");
    });
  });

  describe("Step 3: Address Handling", () => {
    it("detects complete address with pincode and city", () => {
      const result = detectIntent(
        "Flat 4B, Sunrise Apartments, MG Road, Andheri West, Mumbai, Maharashtra 400058"
      );
      expect(result.type).toBe("address_message");
      if (result.type === "address_message") {
        expect(result.isComplete).toBe(true);
        expect(result.address).toContain("400058");
      }
    });

    it("detects incomplete address (just a number)", () => {
      const result = detectIntent("122");
      // "122" is a quantity message, not an address
      expect(result.type).not.toBe("address_message");
    });

    it("detects incomplete address without pincode", () => {
      // Partial address with city name but no pincode
      const result = detectIntent("Shop 12, MG Road, Andheri West, Mumbai");
      expect(result.type).toBe("address_message");
      if (result.type === "address_message") {
        expect(result.isComplete).toBe(false);
      }
    });

    it("detects address with pincode only as complete", () => {
      const result = detectIntent(
        "Shop 12, Hill Road, Bandra, Mumbai 400050"
      );
      expect(result.type).toBe("address_message");
      if (result.type === "address_message") {
        expect(result.isComplete).toBe(true);
      }
    });

    it("formats incomplete address request", () => {
      const msg = formatIncompleteAddressMessage();
      expect(msg).toContain("complete delivery address");
      expect(msg).toContain("pincode");
    });
  });

  describe("Step 4: Quantity", () => {
    it("detects quantity message", () => {
      const result = detectIntent("2");
      expect(result.type).toBe("quantity_message");
      if (result.type === "quantity_message") {
        expect(result.quantity).toBe(2);
      }
    });

    it("detects quantity with unit", () => {
      const result = detectIntent("3 strips");
      expect(result.type).toBe("quantity_message");
      if (result.type === "quantity_message") {
        expect(result.quantity).toBe(3);
      }
    });

    it("formats quantity request", () => {
      const msg = formatQuantityRequestMessage({
        productName: "Dolo 650",
        price: 30,
      });
      expect(msg).toContain("How many units");
      expect(msg).toContain("Dolo 650");
      expect(msg).toContain("₹30");
    });
  });

  describe("Step 5: Availability Response", () => {
    it("formats available message", () => {
      const msg = formatAvailabilityMessage({
        productName: "Dolo 650",
        quantity: 2,
        available: true,
        price: 30,
      });
      expect(msg).toContain("available");
      expect(msg).toContain("Dolo 650");
      expect(msg).toContain("Qty: 2");
      expect(msg).toContain("₹60");
      expect(msg).toContain("Would you like to place the order");
    });

    it("formats available message with prescription warning", () => {
      const msg = formatAvailabilityMessage({
        productName: "Dolo 650",
        quantity: 1,
        available: true,
        price: 30,
        prescriptionRequired: true,
      });
      expect(msg).toContain("Prescription Required");
    });

    it("formats unavailable message", () => {
      const msg = formatAvailabilityMessage({
        productName: "Rare Medicine",
        quantity: 1,
        available: false,
      });
      expect(msg).toContain("unavailable");
      expect(msg).toContain("alternative");
    });
  });

  describe("Step 6: Order Summary", () => {
    it("formats order summary with single medicine", () => {
      const msg = formatOrderSummaryMessage({
        medicines: [{ name: "Dolo 650", quantity: 2, price: 30 }],
        deliveryAddress: "Flat 4B, MG Road, Mumbai 400058",
      });
      expect(msg).toContain("confirm your order");
      expect(msg).toContain("Dolo 650");
      expect(msg).toContain("× 2");
      expect(msg).toContain("₹60");
      expect(msg).toContain("MG Road, Mumbai");
      expect(msg).toContain("place this order");
    });

    it("formats order summary with multiple medicines", () => {
      const msg = formatOrderSummaryMessage({
        medicines: [
          { name: "Dolo 650", quantity: 2, price: 30 },
          { name: "Crocin", quantity: 1, price: 25 },
        ],
        deliveryAddress: "123 Test Street, Pune 411001",
      });
      expect(msg).toContain("Dolo 650");
      expect(msg).toContain("Crocin");
      expect(msg).toContain("₹85");
    });

    it("formats order summary with Rx items", () => {
      const msg = formatOrderSummaryMessage({
        medicines: [{ name: "Azithromycin", quantity: 1, price: 120 }],
        deliveryAddress: "Test Address 411001",
        hasRxItems: true,
        rxItems: ["Azithromycin"],
      });
      expect(msg).toContain("Prescription Required for");
      expect(msg).toContain("Azithromycin");
    });
  });

  describe("Step 7: Confirmation", () => {
    it("formats confirmation for single product", () => {
      const msg = formatConfirmationMessage({
        productName: "Dolo 650",
        quantity: 2,
        price: 30,
      });
      expect(msg).toContain("confirmed successfully");
      expect(msg).toContain("Kalyan Chemist");
      expect(msg).toContain("Dolo 650");
      expect(msg).toContain("× 2");
    });

    it("formats confirmation for multiple products", () => {
      const msg = formatConfirmationMessage({
        medicines: [
          { name: "Dolo 650", quantity: 2, price: 30 },
          { name: "Crocin", quantity: 1, price: 25 },
        ],
      });
      expect(msg).toContain("confirmed successfully");
      expect(msg).toContain("Order Summary");
      expect(msg).toContain("Dolo 650");
      expect(msg).toContain("Crocin");
    });
  });

  describe("Step 8: Decline", () => {
    it("formats decline message", () => {
      const msg = formatDeclineMessage();
      expect(msg).toContain("Kalyan Chemist");
      expect(msg).toContain("good health");
    });
  });

  describe("Intent Detection Edge Cases", () => {
    it("handles 'Yes, please' as positive", () => {
      expect(isPositiveResponse("Yes, please")).toBe(true);
    });

    it("handles 'Kar do' as positive", () => {
      expect(isPositiveResponse("Kar do")).toBe(true);
    });

    it("handles 'Order kar do' as positive", () => {
      expect(isPositiveResponse("Order kar do")).toBe(true);
    });

    it("handles 'Theek hai' as positive", () => {
      expect(isPositiveResponse("Theek hai")).toBe(true);
    });

    it("handles 'No, thanks' as negative", () => {
      expect(isNegativeResponse("No, thanks")).toBe(true);
    });

    it("handles 'Nahi' as negative", () => {
      expect(isNegativeResponse("Nahi")).toBe(true);
    });

    it("handles 'Rehne do' as negative", () => {
      expect(isNegativeResponse("Rehne do")).toBe(true);
    });

    it("handles 'cancel' as negative", () => {
      expect(isNegativeResponse("cancel")).toBe(true);
    });

    it("detects add more intent", () => {
      const result = detectIntent("add more");
      expect(result.type).toBe("add_more_medicines");
    });

    it("detects done intent", () => {
      const result = detectIntent("done");
      expect(result.type).toBe("done_adding");
    });

    it("detects 'that's all' as done", () => {
      const result = detectIntent("that's all");
      expect(result.type).toBe("done_adding");
    });

    it("detects 'bas' as done", () => {
      const result = detectIntent("bas");
      expect(result.type).toBe("done_adding");
    });
  });

  describe("Full Conversation Simulation", () => {
    it("simulates happy path: greeting → medicine → address → quantity → summary → confirm", () => {
      // Step 1: Greeting
      const greeting = detectIntent("Hello");
      expect(greeting.type).toBe("greeting");

      // Step 2: Medicine request
      const medicine = detectIntent("I need Dolo 650");
      expect(medicine.type).toBe("medicine_request");

      // Step 3: Address
      const address = detectIntent(
        "Flat 4B, Sunrise Apartments, MG Road, Andheri West, Mumbai 400058"
      );
      expect(address.type).toBe("address_message");
      if (address.type === "address_message") {
        expect(address.isComplete).toBe(true);
      }

      // Step 4: Quantity
      const quantity = detectIntent("2 strips");
      expect(quantity.type).toBe("quantity_message");
      if (quantity.type === "quantity_message") {
        expect(quantity.quantity).toBe(2);
      }

      // Step 5: Confirm
      const confirm = detectIntent("Yes");
      expect(confirm.type).toBe("positive_response");
    });

    it("simulates decline path: greeting → medicine → negative response", () => {
      const greeting = detectIntent("Hi");
      expect(greeting.type).toBe("greeting");

      const medicine = detectIntent("Need paracetamol");
      expect(medicine.type).toBe("medicine_request");

      const decline = detectIntent("No, not now");
      expect(decline.type).toBe("negative_response");
    });

    it("simulates multi-medicine path", () => {
      const request = detectIntent("Dolo and Crocin and Paracetamol");
      expect(request.type).toBe("medicine_request");
      if (request.type === "medicine_request") {
        expect(request.multiple).toBe(true);
        expect(request.allMedicines).toHaveLength(3);
        expect(request.allMedicines).toContain("dolo");
        expect(request.allMedicines).toContain("crocin");
        expect(request.allMedicines).toContain("paracetamol");
      }

      const addMore = detectIntent("also need Crocin Advance");
      // "also need" triggers add_more intent — webhook handles adding the medicine
      expect(addMore.type).toBe("add_more_medicines")

      const done = detectIntent("done");
      expect(done.type).toBe("done_adding");
    });

    it("simulates quantity variations", () => {
      expect(detectIntent("1").type).toBe("quantity_message");
      expect(detectIntent("5").type).toBe("quantity_message");
      expect(detectIntent("10 strips").type).toBe("quantity_message");
      expect(detectIntent("2 tablets").type).toBe("quantity_message");
      expect(detectIntent("3x").type).toBe("quantity_message");
    });
  });
});
