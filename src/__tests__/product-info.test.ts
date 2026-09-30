import { describe, it, expect } from "vitest";
import {
  classifyProduct,
  productDirections,
  productSafety,
  neutralDescription,
  isOral,
  isMedicine,
  NO_CONFIDENT_MATCH_MESSAGE,
  type ProductIdentity,
} from "@/convex/productInfo";

const p = (over: Partial<ProductIdentity> = {}): ProductIdentity => ({
  name: "Dolo 650",
  ...over,
});

describe("classifyProduct", () => {
  it("classifies a condom from its name even when form wrongly says tablet", () => {
    // This is the reported bug: stored as form "tablet" but it is not a medicine.
    const c = classifyProduct(p({ name: "manforce condom", form: "tablet" }));
    expect(c.kind).toBe("condom");
    expect(c.confident).toBe(true);
  });

  it("classifies a glucose monitor as a device, not a tablet", () => {
    expect(classifyProduct(p({ name: "blood glucose monitor", form: "tablet" })).kind).toBe("device");
  });

  it("classifies test strips as a device", () => {
    expect(classifyProduct(p({ name: "Accu-Chek Active Test Strips", form: "tablet" })).kind).toBe("device");
  });

  it("classifies a health drink as nutrition", () => {
    expect(classifyProduct(p({ name: "Ensure Diabetes Care", form: "tablet" })).kind).toBe("nutrition");
  });

  it("classifies oral medicines by form", () => {
    expect(classifyProduct(p({ name: "Dolo 650", form: "tablet" })).kind).toBe("oral_tablet");
    expect(classifyProduct(p({ name: "Omez 20", form: "capsule" })).kind).toBe("oral_capsule");
    expect(classifyProduct(p({ name: "Ascoril LS", form: "syrup" })).kind).toBe("oral_syrup");
    expect(classifyProduct(p({ name: "Enterogermina", form: "sachet" })).kind).toBe("oral_powder");
  });

  it("classifies topical, eye, nasal and inhaled products", () => {
    expect(classifyProduct(p({ name: "Volini", form: "gel" })).kind).toBe("topical");
    expect(classifyProduct(p({ name: "Betnovate-N", form: "cream" })).kind).toBe("topical");
    expect(classifyProduct(p({ name: "Ciplox", form: "eye drops" })).kind).toBe("eye_drop");
    expect(classifyProduct(p({ name: "Nasivion", form: "nasal drops" })).kind).toBe("nasal");
    expect(classifyProduct(p({ name: "Asthalin", form: "inhaler" })).kind).toBe("inhaler");
  });

  it("classifies a supplement from its composition", () => {
    expect(
      classifyProduct(p({ name: "HealthKart HK Vitals", composition: "Vitamin B1 + B6 + B12" })).kind
    ).toBe("supplement");
  });

  it("returns unknown and unconfident when nothing identifies the product", () => {
    const c = classifyProduct(p({ name: "ominident" }));
    expect(c.kind).toBe("unknown");
    expect(c.confident).toBe(false);
  });

  it("classifies named condom variants as condoms", () => {
    expect(classifyProduct(p({ name: "durex condom" })).kind).toBe("condom");
    expect(classifyProduct(p({ name: "Skore condom" })).kind).toBe("condom");
  });
});

describe("productDirections", () => {
  it("never gives oral instructions to a condom", () => {
    const input = p({ name: "manforce condom", form: "tablet" });
    const kind = classifyProduct(input).kind;
    const directions = productDirections(input, kind)!;
    expect(directions).toBeTruthy();
    expect(directions.toLowerCase()).not.toMatch(/orally|swallow|with water/);
    expect(directions.toLowerCase()).toContain("condom");
  });

  it("never gives oral instructions to a device", () => {
    const input = p({ name: "Accu-Chek Active Test Strips", form: "tablet" });
    const directions = productDirections(input)!;
    expect(directions.toLowerCase()).not.toMatch(/orally|swallow|take the tablet/);
    expect(directions.toLowerCase()).toContain("device");
  });

  it("gives eye drops eye-specific directions, not oral ones", () => {
    const d = productDirections(p({ name: "Ciplox", form: "eye drops" }))!;
    expect(d.toLowerCase()).toMatch(/instil|eye/);
    expect(d.toLowerCase()).not.toMatch(/orally|swallow/);
  });

  it("gives creams topical directions", () => {
    const d = productDirections(p({ name: "Betnovate-N", form: "cream" }))!;
    expect(d.toLowerCase()).toMatch(/apply|skin/);
    expect(d.toLowerCase()).not.toMatch(/orally|swallow/);
  });

  it("gives syrups measuring-device directions", () => {
    const d = productDirections(p({ name: "Ascoril LS", form: "syrup" }))!;
    expect(d.toLowerCase()).toMatch(/measuring/);
  });

  it("gives nutrition products preparation directions rather than medicine ones", () => {
    const d = productDirections(p({ name: "Ensure Diabetes Care", form: "tablet" }))!;
    expect(d.toLowerCase()).not.toMatch(/orally|swallow/);
  });

  it("returns null for an unknown product rather than guessing", () => {
    expect(productDirections(p({ name: "ominident" }))).toBeNull();
  });

  it("gives different directions for different product types", () => {
    const results = [
      productDirections(p({ name: "x", form: "tablet" })),
      productDirections(p({ name: "x", form: "syrup" })),
      productDirections(p({ name: "x", form: "cream" })),
      productDirections(p({ name: "x condom" })),
      productDirections(p({ name: "x monitor" })),
    ];
    expect(new Set(results).size).toBe(5);
  });
});

describe("productSafety", () => {
  it("gives condom-specific safety including expiry and latex guidance", () => {
    const s = productSafety(p({ name: "manforce condom", form: "tablet" }))!;
    expect(s.toLowerCase()).toMatch(/expire|single use|latex/);
    expect(s).not.toMatch(/orally|swallow/);
  });

  it("returns null for an unknown product", () => {
    expect(productSafety(p({ name: "ominident" }))).toBeNull();
  });

  it("does not invent a drug dosing schedule", () => {
    const s = productSafety(p({ name: "Dolo 650", form: "tablet" }))!;
    expect(s).not.toMatch(/\d+\s*(mg|ml)\s*(every|twice|once daily)/i);
  });
});

describe("neutralDescription", () => {
  it("does not call a condom a medication", () => {
    const d = neutralDescription(p({ name: "manforce condom", form: "tablet" }), "condom");
    expect(d.toLowerCase()).not.toContain("medication");
    expect(d).toContain("barrier contraceptive");
  });

  it("does not call a device a medication", () => {
    const d = neutralDescription(p({ name: "Accu-Chek Strips" }), "device");
    expect(d.toLowerCase()).toContain("medical device");
    expect(d.toLowerCase()).not.toContain("medication");
  });
});

describe("helpers", () => {
  it("knows which kinds are oral and which are medicines", () => {
    expect(isOral("oral_tablet")).toBe(true);
    expect(isOral("topical")).toBe(false);
    expect(isMedicine("oral_syrup")).toBe(true);
    expect(isMedicine("condom")).toBe(false);
    expect(isMedicine("device")).toBe(false);
  });

  it("states that both the reference catalogue and the online sources were checked", () => {
    // The message is shown only after the curated catalogue AND the online
    // product lookup have both failed, so it must name both — and must never
    // blame a local list for a real product that simply is not in it.
    expect(NO_CONFIDENT_MATCH_MESSAGE).toMatch(/reference catalogue/i);
    expect(NO_CONFIDENT_MATCH_MESSAGE).toMatch(/online product source/i);
    expect(NO_CONFIDENT_MATCH_MESSAGE).not.toMatch(/MEDICINES_DB/);
  });
});
