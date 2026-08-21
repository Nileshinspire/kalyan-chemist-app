/**
 * Tests for WhatsApp conversational order flow message parser
 */
import { describe, it, expect } from "vitest";
import {
  detectIntent,
  isPositiveResponse,
  isNegativeResponse,
  extractMedicineRequest,
  formatAvailabilityMessage,
  formatConfirmationMessage,
  formatDeclineMessage,
  formatGreetingMessage,
} from "../lib/whatsappParser";

// ══════════════════════════════════════════════════════
//  INTENT DETECTION
// ══════════════════════════════════════════════════════

describe("detectIntent", () => {
  it("detects medicine requests", () => {
    const result = detectIntent("paracetamol");
    expect(result.type).toBe("medicine_request");
    if (result.type === "medicine_request") {
      expect(result.medicine).toBe("paracetamol");
      expect(result.quantity).toBe(1);
    }
  });

  it("detects medicine requests with quantity", () => {
    const result = detectIntent("2 paracetamol");
    expect(result.type).toBe("medicine_request");
    if (result.type === "medicine_request") {
      expect(result.medicine).toBe("paracetamol");
      expect(result.quantity).toBe(2);
    }
  });

  it("detects medicine requests with prefix phrases", () => {
    const result = detectIntent("i want crocin 500");
    expect(result.type).toBe("medicine_request");
    if (result.type === "medicine_request") {
      expect(result.medicine).toContain("crocin");
    }
  });

  it("detects positive responses", () => {
    expect(detectIntent("yes").type).toBe("positive_response");
    expect(detectIntent("Yes, please").type).toBe("positive_response");
    expect(detectIntent("confirm").type).toBe("positive_response");
    expect(detectIntent("go ahead").type).toBe("positive_response");
    expect(detectIntent("ok").type).toBe("positive_response");
    expect(detectIntent("haan").type).toBe("positive_response");
    expect(detectIntent("thik hai").type).toBe("positive_response");
  });

  it("detects negative responses", () => {
    expect(detectIntent("no").type).toBe("negative_response");
    expect(detectIntent("No, thanks").type).toBe("negative_response");
    expect(detectIntent("cancel").type).toBe("negative_response");
    expect(detectIntent("nahi").type).toBe("negative_response");
    expect(detectIntent("not now").type).toBe("negative_response");
  });

  it("detects greetings", () => {
    expect(detectIntent("hi").type).toBe("greeting");
    expect(detectIntent("hello").type).toBe("greeting");
    expect(detectIntent("hey").type).toBe("greeting");
    expect(detectIntent("namaste").type).toBe("greeting");
  });

  it("returns unknown for symbols and very short messages", () => {
    expect(detectIntent("???").type).toBe("unknown");
    expect(detectIntent("...").type).toBe("unknown");
  });
});

// ══════════════════════════════════════════════════════
//  POSITIVE RESPONSE DETECTION
// ══════════════════════════════════════════════════════

describe("isPositiveResponse", () => {
  it("matches exact simple responses", () => {
    expect(isPositiveResponse("yes")).toBe(true);
    expect(isPositiveResponse("ok")).toBe(true);
    expect(isPositiveResponse("sure")).toBe(true);
    expect(isPositiveResponse("confirm")).toBe(true);
    expect(isPositiveResponse("y")).toBe(true);
  });

  it("matches case-insensitive", () => {
    expect(isPositiveResponse("YES")).toBe(true);
    expect(isPositiveResponse("Yes")).toBe(true);
    expect(isPositiveResponse("OK")).toBe(true);
  });

  it("matches compound responses", () => {
    expect(isPositiveResponse("yes please")).toBe(true);
    expect(isPositiveResponse("go ahead")).toBe(true);
    expect(isPositiveResponse("i want it")).toBe(true);
    expect(isPositiveResponse("please order")).toBe(true);
  });

  it("matches Hindi responses", () => {
    expect(isPositiveResponse("haan")).toBe(true);
    expect(isPositiveResponse("thik hai")).toBe(true);
    expect(isPositiveResponse("ji")).toBe(true);
    expect(isPositiveResponse("bilkul")).toBe(true);
    expect(isPositiveResponse("order karo")).toBe(true);
  });

  it("does not match negative messages", () => {
    expect(isPositiveResponse("no")).toBe(false);
    expect(isPositiveResponse("cancel")).toBe(false);
    expect(isPositiveResponse("paracetamol")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
//  NEGATIVE RESPONSE DETECTION
// ══════════════════════════════════════════════════════

describe("isNegativeResponse", () => {
  it("matches exact simple responses", () => {
    expect(isNegativeResponse("no")).toBe(true);
    expect(isNegativeResponse("cancel")).toBe(true);
    expect(isNegativeResponse("skip")).toBe(true);
    expect(isNegativeResponse("pass")).toBe(true);
  });

  it("matches compound responses", () => {
    expect(isNegativeResponse("not now")).toBe(true);
    expect(isNegativeResponse("no thanks")).toBe(true);
    expect(isNegativeResponse("not interested")).toBe(true);
    expect(isNegativeResponse("forget it")).toBe(true);
  });

  it("matches Hindi responses", () => {
    expect(isNegativeResponse("nahi")).toBe(true);
    expect(isNegativeResponse("mat bhejo")).toBe(true);
    expect(isNegativeResponse("baad mein")).toBe(true);
  });

  it("does not match positive messages", () => {
    expect(isNegativeResponse("yes")).toBe(false);
    expect(isNegativeResponse("ok")).toBe(false);
    expect(isNegativeResponse("paracetamol")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════
//  MEDICINE REQUEST EXTRACTION
// ══════════════════════════════════════════════════════

describe("extractMedicineRequest", () => {
  it("extracts simple medicine name", () => {
    const result = extractMedicineRequest("paracetamol");
    expect(result).not.toBeNull();
    expect(result!.medicine).toBe("paracetamol");
    expect(result!.quantity).toBe(1);
  });

  it("extracts medicine with leading quantity", () => {
    const result = extractMedicineRequest("2 paracetamol");
    expect(result).not.toBeNull();
    expect(result!.medicine).toBe("paracetamol");
    expect(result!.quantity).toBe(2);
  });

  it("extracts medicine with quantity and strip suffix", () => {
    const result = extractMedicineRequest("paracetamol 2 strips");
    expect(result).not.toBeNull();
    expect(result!.medicine).toBe("paracetamol");
    expect(result!.quantity).toBe(2);
  });

  it("handles 'need' prefix", () => {
    const result = extractMedicineRequest("need paracetamol");
    expect(result).not.toBeNull();
    expect(result!.medicine).toBe("paracetamol");
  });

  it("handles 'i want' prefix", () => {
    const result = extractMedicineRequest("i want crocin");
    expect(result).not.toBeNull();
    expect(result!.medicine).toContain("croc");
  });

  it("handles 'do you have' prefix", () => {
    const result = extractMedicineRequest("do you have paracetamol");
    expect(result).not.toBeNull();
    expect(result!.medicine).toBe("paracetamol");
  });

  it("caps quantity at 99", () => {
    const result = extractMedicineRequest("200 paracetamol");
    expect(result).not.toBeNull();
    expect(result!.quantity).toBe(99);
  });

  it("returns null for empty input", () => {
    expect(extractMedicineRequest("")).toBeNull();
    expect(extractMedicineRequest("   ")).toBeNull();
  });

  it("returns null for single character", () => {
    expect(extractMedicineRequest("a")).toBeNull();
  });

  it("returns null for yes/no", () => {
    expect(extractMedicineRequest("yes")).toBeNull();
    expect(extractMedicineRequest("no")).toBeNull();
  });

  it("handles medicine with dosage in name", () => {
    const result = extractMedicineRequest("crocin 500");
    expect(result).not.toBeNull();
    expect(result!.medicine).toContain("crocin");
  });

  it("handles 'buy' prefix", () => {
    const result = extractMedicineRequest("buy dolo 650");
    expect(result).not.toBeNull();
    expect(result!.medicine).toContain("dolo");
  });
});

// ══════════════════════════════════════════════════════
//  MESSAGE FORMATTING
// ══════════════════════════════════════════════════════

describe("formatAvailabilityMessage", () => {
  it("formats available medicine message", () => {
    const msg = formatAvailabilityMessage({
      productName: "Paracetamol 500mg",
      quantity: 2,
      available: true,
      price: 45,
    });
    expect(msg).toContain("Yes, we have your requested medicine");
    expect(msg).toContain("Paracetamol 500mg");
    expect(msg).toContain("Qty: 2");
    expect(msg).toContain("₹45");
    expect(msg).toContain("Would you like to place the order?");
    expect(msg).toContain("Reply *Yes* to confirm");
  });

  it("formats unavailable medicine message", () => {
    const msg = formatAvailabilityMessage({
      productName: "Rare Drug",
      quantity: 1,
      available: false,
    });
    expect(msg).toContain("Sorry, the requested medicine or quantity is currently unavailable");
    expect(msg).toContain("alternative");
  });

  it("includes prescription warning when required", () => {
    const msg = formatAvailabilityMessage({
      productName: "Dolo 650",
      quantity: 1,
      available: true,
      price: 30,
      prescriptionRequired: true,
    });
    expect(msg).toContain("Prescription Required");
    expect(msg).toContain("prescription");
  });

  it("does not include prescription warning when not required", () => {
    const msg = formatAvailabilityMessage({
      productName: "Vitamin C",
      quantity: 1,
      available: true,
      price: 100,
      prescriptionRequired: false,
    });
    expect(msg).not.toContain("Prescription Required");
  });
});

describe("formatConfirmationMessage", () => {
  it("formats confirmation with details", () => {
    const msg = formatConfirmationMessage({
      productName: "Paracetamol",
      quantity: 2,
      price: 45,
    });
    expect(msg).toContain("confirmed successfully");
    expect(msg).toContain("Kalyan Chemist");
    expect(msg).toContain("Paracetamol");
    expect(msg).toContain("2");
    expect(msg).toContain("₹45");
  });

  it("formats confirmation without price", () => {
    const msg = formatConfirmationMessage({
      productName: "Ibuprofen",
      quantity: 1,
    });
    expect(msg).toContain("confirmed successfully");
    expect(msg).toContain("Ibuprofen");
  });
});

describe("formatDeclineMessage", () => {
  it("formats polite decline message", () => {
    const msg = formatDeclineMessage();
    expect(msg).toContain("Thank you");
    expect(msg).toContain("Kalyan Chemist");
    expect(msg).toContain("good health");
  });
});

describe("formatGreetingMessage", () => {
  it("formats welcome greeting", () => {
    const msg = formatGreetingMessage();
    expect(msg).toContain("Welcome");
    expect(msg).toContain("Kalyan Chemist");
    expect(msg).toContain("medicine name");
  });
});

// ══════════════════════════════════════════════════════
//  CONVERSATION FLOW INTEGRATION
// ══════════════════════════════════════════════════════

describe("Conversational flow end-to-end", () => {
  it("Step 1: Customer sends medicine request → detect intent", () => {
    const intent = detectIntent("need 2 dolo 650");
    expect(intent.type).toBe("medicine_request");
    if (intent.type === "medicine_request") {
      expect(intent.medicine).toContain("dolo");
      expect(intent.quantity).toBe(2);
    }
  });

  it("Step 2: System sends availability → format response", () => {
    const msg = formatAvailabilityMessage({
      productName: "Dolo 650",
      quantity: 2,
      available: true,
      price: 30,
      prescriptionRequired: false,
    });
    expect(msg).toContain("Yes, we have");
    expect(msg).toContain("Would you like to place the order?");
  });

  it("Step 3: Customer says YES → detect positive response", () => {
    const intent = detectIntent("Yes, please");
    expect(intent.type).toBe("positive_response");
    expect(isPositiveResponse("yes")).toBe(true);
  });

  it("Step 4: System confirms → format confirmation", () => {
    const msg = formatConfirmationMessage({
      productName: "Dolo 650",
      quantity: 2,
      price: 30,
    });
    expect(msg).toContain("confirmed successfully");
  });

  it("Alternative: Customer says NO → detect negative response", () => {
    const intent = detectIntent("no thanks");
    expect(intent.type).toBe("negative_response");
    expect(isNegativeResponse("no")).toBe(true);
  });

  it("Alternative: System sends decline message", () => {
    const msg = formatDeclineMessage();
    expect(msg).toContain("Thank you");
    expect(msg).toContain("good health");
  });

  it("Out of stock: System sends unavailable message", () => {
    const msg = formatAvailabilityMessage({
      productName: "Rare Drug",
      quantity: 5,
      available: false,
    });
    expect(msg).toContain("currently unavailable");
    expect(msg).not.toContain("Would you like to place the order?");
  });

  it("Customer requests different medicine mid-conversation", () => {
    const intent = detectIntent("actually give me crocin 500 instead");
    expect(intent.type).toBe("medicine_request");
    if (intent.type === "medicine_request") {
      expect(intent.medicine).toContain("croc");
    }
  });

  it("Greeting starts conversation properly", () => {
    const intent = detectIntent("hello");
    expect(intent.type).toBe("greeting");
    const msg = formatGreetingMessage();
    expect(msg).toContain("Welcome");
  });
});

// ══════════════════════════════════════════════════════
//  EDGE CASES
// ══════════════════════════════════════════════════════

describe("Edge cases", () => {
  it("handles messages with extra whitespace", () => {
    const intent = detectIntent("  yes  ");
    expect(intent.type).toBe("positive_response");
  });

  it("handles messages with punctuation", () => {
    expect(isPositiveResponse("yes!")).toBe(true);
    expect(isPositiveResponse("ok?")).toBe(true);
    expect(isNegativeResponse("no!")).toBe(true);
  });

  it("handles mixed case medicine requests", () => {
    const result = extractMedicineRequest("PARACETAMOL");
    expect(result).not.toBeNull();
    expect(result!.medicine).toBe("paracetamol");
  });

  it("handles 'x' quantity notation", () => {
    const result = extractMedicineRequest("2x paracetamol");
    expect(result).not.toBeNull();
    expect(result!.quantity).toBe(2);
  });

  it("treats medicine name that looks like yes/no as medicine", () => {
    // "yeso" is not a recognized positive response, should be treated as medicine
    const intent = detectIntent("need yeso tablet");
    expect(intent.type).toBe("medicine_request");
  });

  it("handles realistic customer messages", () => {
    const result = extractMedicineRequest("please order paracetamol for me");
    expect(result).not.toBeNull();
    if (result) {
      expect(result.medicine).toContain("paracetamol");
    }
  });
});
