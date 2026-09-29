import { describe, it, expect } from "vitest";
import {
  MEDICINES_DB,
  findVerifiedReference,
  strengthConflicts,
  routeConflicts,
  getStorageInfo,
} from "@/convex/productReference";
import {
  buildProductContent,
  parseComposition,
  ingredientRole,
  BENEFITS_UNAVAILABLE,
  INGREDIENTS_UNAVAILABLE,
  DIRECTIONS_UNAVAILABLE,
  type ProductContentInput,
} from "@/convex/productContent";

/**
 * These tests guard the promise the storefront makes on a product page: every
 * fact below the product card belongs to THAT product, and nothing medical is
 * invented to fill a gap.
 */

/** Copy that would be wrong on a product that is not taken by mouth. */
const ORAL_MARKERS =
  /\b(swallow|by mouth|dissolve|glass of water|course of treatment|missed dose|dose schedule|as directed by your physician)\b/i;

/** Any invented dose. Timings must defer to the pack or the doctor instead. */
const INVENTED_DOSE = /\b\d+(\.\d+)?\s*(mg|mcg|ml|iu|%)\b/i;

const PRODUCT: ProductContentInput = {
  name: "Dolo 650",
  form: "tablet",
  packSize: "15 tablets",
  manufacturer: "Micro Labs Ltd",
  composition: "Paracetamol 650mg",
  strength: "650mg",
  prescriptionRequired: false,
};

const build = (input: ProductContentInput) => buildProductContent(input);

describe("verified reference lookup", () => {
  it("matches a product to the record for its exact variant", () => {
    const { reference } = findVerifiedReference(PRODUCT);
    expect(reference?.key).toBe("dolo");
    expect(reference?.composition).toBe("Paracetamol 650mg");
  });

  it("refuses to give a different strength's record to the same brand", () => {
    // Dolo 500 is not the Dolo 650 tablet. Borrowing its composition would
    // state the wrong dose for the pack in front of the customer.
    const { reference, rejected } = findVerifiedReference({
      name: "Dolo 500",
      form: "tablet",
      packSize: "10 tablets",
      composition: "Paracetamol 500mg",
      strength: "500mg",
    });
    expect(reference).toBeNull();
    expect(rejected).toMatch(/different strength/i);
  });

  it("accepts any strength the record actually covers", () => {
    for (const strength of ["500mg", "650mg"]) {
      const { reference } = findVerifiedReference({
        name: `Crocin ${strength.replace("mg", "")}`,
        form: "tablet",
        composition: `Paracetamol ${strength}`,
        strength,
      });
      expect(reference?.key).toBe("crocin");
    }
  });

  it("refuses a record whose dosage form is not this product's", () => {
    // A condom sharing a brand name with a tablet must never be handed the
    // tablet's composition.
    expect(routeConflicts({ name: "Manforce Condom", form: "tablet" }, MEDICINES_DB.dolo)).toBe(
      true
    );
    expect(routeConflicts({ name: "Volini Gel 30g", form: "gel" }, MEDICINES_DB.volini)).toBe(
      false
    );
  });

  it("treats a pack weight as a pack size, not a dose", () => {
    // "30g" is a tube size. Reading it as a strength would reject a correct
    // match for the gel.
    expect(
      strengthConflicts({ name: "Volini Gel 30g", form: "gel" }, MEDICINES_DB.volini)
    ).toBe(false);
  });

  it("prefers the most specific record for a brand with several formats", () => {
    const spray = findVerifiedReference({ name: "Volini Spray", form: "spray" });
    const gel = findVerifiedReference({ name: "Volini Gel", form: "gel" });
    expect(spray.reference?.form).toBe("spray");
    expect(gel.reference?.form).toBe("gel");
  });

  it("keeps a product on its own format when only the brand name matched", () => {
    // "Volini" is catalogued as a gel, but this product is recorded as a
    // spray, so the spray instructions are the ones that belong to it.
    const content = build({ name: "Volini Pain Relief Spray", form: "spray" });
    expect(content.kind).toBe("topical");
    expect(content.directions).not.toMatch(ORAL_MARKERS);
  });

  it("returns nothing for a product with no verified record", () => {
    const { reference } = findVerifiedReference({ name: "Glucon-D Powder", form: "powder" });
    expect(reference).toBeNull();
  });

  it("does not let a combination product borrow one brand's record", () => {
    // "Dolo Neurobion Forte" contains both catalogued names but is neither of
    // them, so neither record may be applied.
    const { reference, rejected } = findVerifiedReference({
      name: "Dolo Neurobion Forte",
      form: "tablet",
      composition: "Vitamin B1 + B6 + B12",
    });
    expect(reference).toBeNull();
    expect(rejected).toMatch(/more than one/i);
  });

  it("still matches a brand whose longer key extends another", () => {
    // "zandu" and "zandu balm" are one product, not a combination.
    expect(findVerifiedReference({ name: "Zandu Balm", form: "balm" }).reference?.key).toBe(
      "zandu balm"
    );
    expect(findVerifiedReference({ name: "Zandu Pain Relief Balm", form: "balm" }).reference).not
      .toBeNull();
  });
});

describe("composition parsing", () => {
  it("keeps each ingredient with its own strength", () => {
    expect(parseComposition("Ibuprofen 400mg + Paracetamol 325mg")).toEqual([
      { name: "Ibuprofen", strength: "400mg", role: expect.any(String) },
      { name: "Paracetamol", strength: "325mg", role: expect.any(String) },
    ]);
  });

  it("leaves an ingredient with no stated dose rather than borrowing one", () => {
    const [ingredient] = parseComposition("Levosalbutamol + Ambroxol");
    expect(ingredient).toMatchObject({ name: "Levosalbutamol", strength: null });
  });

  it("reads a percentage strength", () => {
    expect(parseComposition("Diclofenac Diethylamine 1% w/w")).toEqual([
      { name: "Diclofenac Diethylamine", strength: "1% w/w", role: expect.any(String) },
    ]);
  });

  it("states a role only for an ingredient it recognises", () => {
    expect(ingredientRole("Paracetamol")).toMatch(/pain|fever/i);
    // An unrecognised substance gets no invented role.
    expect(ingredientRole("Unobtainium 5mg")).toBeNull();
  });
});

describe("directions are specific to the exact product", () => {
  const CASES: Array<{ label: string; input: ProductContentInput; oral: boolean }> = [
    { label: "oral tablet", oral: true, input: { name: "Dolo 650", form: "tablet", composition: "Paracetamol 650mg", strength: "650mg" } },
    { label: "capsule", oral: true, input: { name: "Omez 20", form: "capsule", composition: "Omeprazole 20mg" } },
    { label: "syrup", oral: true, input: { name: "Ascoril LS Syrup", form: "syrup", composition: "Levosalbutamol + Ambroxol + Cetirizine" } },
    { label: "sachet powder", oral: true, input: { name: "Enterogermina Sachet", form: "sachet", composition: "Bacillus clausii 2 Billion Spores" } },
    { label: "gel", oral: false, input: { name: "Volini Gel", form: "gel", composition: "Diclofenac Diethylamine + Menthol" } },
    { label: "balm", oral: false, input: { name: "Tiger Balm", form: "ointment", composition: "Menthol + Camphor" } },
    { label: "spray", oral: false, input: { name: "Volini Spray", form: "spray", composition: "Diclofenac Diethylamine" } },
    { label: "nasal drops", oral: false, input: { name: "Nasivion", form: "nasal drops", composition: "Oxymetazoline 0.05%" } },
    { label: "antacid powder", oral: true, input: { name: "ENO", form: "powder", composition: "Sodium Bicarbonate + Citric Acid" } },
    { label: "condom", oral: false, input: { name: "Manforce Condom", form: "tablet" } },
    { label: "test strips", oral: false, input: { name: "Accu-Chek Active Test Strips", form: "tablet" } },
    { label: "nutrition powder", oral: false, input: { name: "Ensure Diabetes Care", form: "tablet" } },
  ];

  it.each(CASES)("$label gets directions that match its route", ({ input, oral }) => {
    const directions = build(input).directions;
    expect(directions).toBeTruthy();
    if (oral) {
      expect(directions).toMatch(/swallow|by mouth|dissolve/i);
    } else {
      expect(directions).not.toMatch(ORAL_MARKERS);
    }
  });

  it("never tells a topical product to swallow anything", () => {
    // The exact reported failure: a gel described with tablet instructions.
    const content = build({ name: "Volini Gel", form: "gel", composition: "Diclofenac Diethylamine" });
    expect(content.kind).toBe("topical");
    expect(content.directions).not.toMatch(ORAL_MARKERS);
    expect(content.directions).toMatch(/skin|apply/i);
  });

  it("never gives a device a medicine dose", () => {
    const content = build({ name: "Accu-Chek Active Test Strips", form: "tablet" });
    expect(content.kind).toBe("device");
    expect(content.directions).not.toMatch(ORAL_MARKERS);
    expect(`${content.timing} ${content.duration} ${content.important}`).not.toMatch(INVENTED_DOSE);
  });

  it("gives a supplement its own preparation wording, not tablet wording", () => {
    const content = build({ name: "Shelcal 500", form: "tablet", composition: "Calcium Carbonate 500mg" });
    expect(content.directions).toMatch(/food|pack|label/i);
    expect(content.directions).not.toMatch(/glass of water/i);
  });

  it("withholds directions when the product type cannot be established", () => {
    const content = build({ name: "Unbranded Item 4471" });
    expect(content.kindConfident).toBe(false);
    expect(content.directions).toBeNull();
    expect(content.directionsNote).toBe(DIRECTIONS_UNAVAILABLE);
  });
});

describe("no dosage is ever invented", () => {
  it("defers to the doctor for a prescription product", () => {
    const content = build({
      name: "Augmentin 625 Duo",
      form: "tablet",
      packSize: "10 tablets",
      composition: "Amoxicillin 500mg + Clavulanic Acid 125mg",
      strength: "625mg",
      prescriptionRequired: true,
    });
    expect(content.timing).toMatch(/as directed by your doctor or pharmacist/i);
    expect(content.timing).not.toMatch(INVENTED_DOSE);
    expect(content.duration).not.toMatch(INVENTED_DOSE);
  });

  it("defers to the pack for an over-the-counter product", () => {
    const content = build(PRODUCT);
    expect(content.timing).toMatch(/pack/i);
    expect(content.timing).not.toMatch(INVENTED_DOSE);
  });

  it("never states a dose anywhere in the generated content", () => {
    for (const input of CASES_FOR_DOSE) {
      const c = build(input);
      for (const value of [c.timing, c.duration, c.important, c.directions].filter(Boolean)) {
        expect(value).not.toMatch(/\b(take|use|apply|instil)\s+\d+/i);
      }
    }
  });
});

const CASES_FOR_DOSE: ProductContentInput[] = [
  { name: "Dolo 650", form: "tablet", composition: "Paracetamol 650mg" },
  { name: "Ascoril LS Syrup", form: "syrup" },
  { name: "Volini Gel", form: "gel" },
  { name: "Accu-Chek Active Test Strips", form: "tablet" },
  { name: "Manforce Condom", form: "tablet" },
  { name: "Unknown Widget", form: "widget" },
];

describe("benefits come from verified data only", () => {
  it("uses the verified record's benefits", () => {
    const content = build(PRODUCT);
    expect(content.benefits).toEqual([
      "Provides effective relief from mild to moderate pain and reduces fever.",
      "Safe and well-tolerated when used as directed.",
    ]);
  });

  it("introduces the benefits without splicing a sentence into a phrase", () => {
    // "is used for provides effective relief" — the old phrasing read as a
    // broken sentence because a benefit clause is not a noun phrase.
    for (const input of [PRODUCT, { name: "Volini Gel", form: "gel" }]) {
      const content = build(input);
      expect(content.benefitsIntro).not.toMatch(/is used for provides|is used for topical/i);
    }
  });

  it("ignores benefits of unknown origin rather than showing them", () => {
    const content = build({
      name: "Some Health Tonic",
      form: "syrup",
      // Present on the row, but never declared as coming from the pack or the
      // manufacturer. The old generator produced copy like this.
      benefits: "Effective medication in convenient oral dosage form.",
    });
    expect(content.benefits).toBeNull();
  });

  it("accepts benefits the admin declared came from the packaging", () => {
    const content = build({
      name: "Some Health Tonic",
      form: "syrup",
      benefits: "Used to support appetite.",
      benefitsSource: "packaging",
    });
    expect(content.benefits).toEqual(["Used to support appetite."]);
  });

  it("withholds benefits rather than deriving them from the dosage form", () => {
    // Nothing about a tablet makes it a pain reliever, a probiotic or a
    // supplement, so a tablet with no record has no benefits.
    for (const form of ["tablet", "capsule", "syrup", "gel", "powder", "drops"]) {
      const content = build({ name: `Unlisted 500 Widget ${form}`, form });
      expect(content.benefits).toBeNull();
    }
  });
});

describe("ingredients", () => {
  it("lists the exact composition of the product", () => {
    const content = build({
      name: "Combiflam",
      form: "tablet",
      composition: "Ibuprofen 400mg + Paracetamol 325mg",
    });
    expect(content.ingredients?.map((i) => i.name)).toEqual(["Ibuprofen", "Paracetamol"]);
    expect(content.ingredients?.map((i) => i.strength)).toEqual(["400mg", "325mg"]);
  });

  it("never repeats a generic sentence for every ingredient", () => {
    const content = build(PRODUCT);
    for (const ingredient of content.ingredients ?? []) {
      expect(ingredient.role ?? "").not.toMatch(/contributing to the therapeutic effect/i);
    }
  });

  it("leaves the role empty rather than guessing", () => {
    const [ingredient] = parseComposition("Unobtainium 5mg");
    expect(ingredient.role).toBeNull();
  });

  it("says so when the composition is unknown", () => {
    const content = build({ name: "Mystery Item", form: "gel" });
    expect(content.ingredients).toBeNull();
    expect(content.ingredientsNote).toBeNull();
    // The page falls back to this exact message.
    expect(INGREDIENTS_UNAVAILABLE).toMatch(/not currently available/i);
  });

  it("ignores a drug composition recorded on a condom", () => {
    // Older rows carry a real drug composition on products that have no active
    // ingredients. Showing it would invent an ingredient list and a storage
    // temperature for a condom.
    const content = build({
      name: "durex condom",
      form: "condom",
      packSize: "10",
      composition: "Paracetamol 500mg / 650mg",
    });
    expect(content.ingredients).toBeNull();
    expect(content.safety.find((s) => s.label === "Storage")?.value).not.toMatch(/25°C/);
    expect(content.safety.find((s) => s.label === "Allergies and reactions")?.value).not.toMatch(
      /Paracetamol/
    );
  });

  it("ignores a drug composition recorded on a test strip", () => {
    const content = build({
      name: "Accu-Chek Active Strips",
      form: "tablet",
      composition: "Glucose Oxidase",
    });
    expect(content.kind).toBe("device");
    expect(content.ingredients).toBeNull();
  });
});

describe("information is product data, never website copy", () => {
  it("lists verified product facts", () => {
    const content = build(PRODUCT);
    const labels = content.information.map((f) => f.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Manufacturer",
        "Product type",
        "Composition",
        "Pack size",
        "Prescription status",
        "Handling route",
      ])
    );
    const all = content.information.map((f) => f.value).join(" ");
    expect(all).not.toMatch(/order online|delivery|pay securely|customer support|returns/i);
  });

  it("marks a prescription product as such", () => {
    const content = build({ ...PRODUCT, prescriptionRequired: true });
    expect(
      content.information.find((f) => f.label === "Prescription status")?.value
    ).toMatch(/prescription only/i);
  });

  it("carries the product's own expiry date when recorded", () => {
    const content = build({ ...PRODUCT, expiryDate: Date.UTC(2028, 5, 30) });
    expect(content.safety.find((s) => s.label === "Expiry")?.value).toMatch(/30 Jun 2028/);
  });
});

describe("safety is specific to the product", () => {
  it("names the product's own ingredients in the allergy warning", () => {
    const content = build(PRODUCT);
    expect(content.safety.find((s) => s.label === "Allergies and reactions")?.value).toMatch(
      /Paracetamol/
    );
  });

  it("does not call a device an allergy risk", () => {
    const content = build({ name: "Accu-Chek Active Test Strips", form: "tablet" });
    const allergy = content.safety.find((s) => s.label === "Device faults")?.value ?? "";
    expect(allergy).toMatch(/medical device/i);
    expect(allergy).not.toMatch(/before taking/i);
  });

  it("writes different storage copy for different product types", () => {
    const tablet = build(PRODUCT).safety.find((s) => s.label === "Storage")?.value;
    const device = build({ name: "Accu-Chek Active Test Strips", form: "tablet" })
      .safety.find((s) => s.label === "Storage")?.value;
    expect(tablet).toBeTruthy();
    expect(device).toBeTruthy();
    expect(tablet).not.toBe(device);
  });

  it("uses the product's recorded storage guidance when it has one", () => {
    const content = build({ ...PRODUCT, storageInformation: "Store in a fridge at 2–8°C." });
    expect(content.safety.find((s) => s.label === "Storage")?.value).toBe(
      "Store in a fridge at 2–8°C."
    );
  });

  it("ignores a drug storage temperature recorded on a condom", () => {
    // A condom row inherited "Store below 25°C" from the paracetamol
    // composition it was mistakenly given. Neither the stored value nor the
    // ingredient-derived one may survive on a product with no drug in it.
    const content = build({
      name: "durex condom",
      form: "condom",
      composition: "Paracetamol 500mg / 650mg",
      storageInformation: "Store below 25°C in a dry place.",
    });
    expect(content.safety.find((s) => s.label === "Storage")?.value).not.toMatch(/25°C/);
    expect(content.safety.find((s) => s.label === "Storage")?.value).toMatch(/pack/i);
  });

  it("does not assert a storage temperature it cannot source", () => {
    // No composition, no form, no record: nothing to derive storage from.
    const content = build({ name: "Enigma", form: "widget", composition: null });
    expect(content.safety.find((s) => s.label === "Storage")?.value).toMatch(/not currently available/i);
  });
});

describe("FAQs are generated from the exact product", () => {
  it("asks about this product by name", () => {
    const content = build(PRODUCT);
    expect(content.faqs.map((f) => f.question)).toEqual(
      expect.arrayContaining([
        "What is Dolo 650?",
        "How should Dolo 650 be used?",
        "What is the composition of Dolo 650?",
        "Is Dolo 650 a prescription-only medicine?",
        "What precautions should I take with Dolo 650?",
        "What is the strength and pack size of Dolo 650?",
      ])
    );
  });

  it("answers with this product's verified data", () => {
    const faqs = build(PRODUCT).faqs;
    const composition = faqs.find((f) => f.question.startsWith("What is the composition"))!;
    expect(composition.answer).toMatch(/Paracetamol \(650mg\)/);
    const identity = faqs.find((f) => f.question.startsWith("What is Dolo"))!;
    expect(identity.answer).toMatch(/Micro Labs Ltd/);
    expect(identity.answer).toMatch(/tablet/);
  });

  it("does not leave a hole where a fact is missing", () => {
    // A product with no recorded strength must not read "is supplied at in a
    // pack of ...".
    const faqs = build({ name: "Volini Gel", form: "gel", packSize: "30g tube" }).faqs;
    const sizing = faqs.find((f) => f.question.startsWith("What is the strength"))!;
    expect(sizing.answer).toBe("The pack contains 30g tube.");
    const rx = faqs.find((f) => f.question.startsWith("Is Volini"))!;
    expect(rx.answer).toMatch(/Over the counter \(OTC\)/);
  });

  it("answers honestly where a fact is not verified", () => {
    const faqs = build({ name: "Glucon-D Powder", form: "powder" }).faqs;
    const composition = faqs.find((f) => f.question.startsWith("What is the composition"))!;
    expect(composition.answer).toBe(INGREDIENTS_UNAVAILABLE);
    const use = faqs.find((f) => f.question.startsWith("What is Glucon-D Powder used for"))!;
    expect(use.answer).toBe(BENEFITS_UNAVAILABLE);
    const identity = faqs.find((f) => f.question === "What is Glucon-D Powder?")!;
    expect(identity.answer).toMatch(/do not have verified product information/i);
  });

  it("never gives two unrelated products the same answers", () => {
    const a = build(PRODUCT).faqs;
    const b = build({ name: "Volini Gel", form: "gel", composition: "Diclofenac Diethylamine" }).faqs;
    expect(a.map((f) => f.answer)).not.toEqual(b.map((f) => f.answer));
  });
});

describe("different products get different content", () => {
  it("gives every product type its own copy", () => {
    const rendered = [
      { name: "Dolo 650", form: "tablet", composition: "Paracetamol 650mg" },
      { name: "Ascoril LS Syrup", form: "syrup" },
      { name: "Volini Gel", form: "gel" },
      { name: "ENO", form: "powder" },
      { name: "Nasivion", form: "nasal drops" },
      { name: "Accu-Chek Active Test Strips", form: "tablet" },
      { name: "Manforce Condom", form: "tablet" },
    ].map((input) => {
      const c = build(input);
      return JSON.stringify([c.kind, c.directions, c.timing, c.duration, c.safety, c.faqs]);
    });
    expect(new Set(rendered).size).toBe(rendered.length);
  });
});

describe("storage guidance", () => {
  it("is derived from the ingredient when it can be", () => {
    expect(getStorageInfo("Paracetamol 650mg", "tablet")).toMatch(/below 25/);
  });

  it("returns nothing rather than guessing", () => {
    expect(getStorageInfo("Unobtainium", "widget")).toBeNull();
  });
});
