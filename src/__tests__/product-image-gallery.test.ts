import { describe, expect, it } from "vitest";
import {
  contentHash,
  isVerifiedProductImage,
  MAX_PRODUCT_IMAGES,
} from "@/convex/productImageResolver";
import {
  auditProductImage,
  hasDuplicateViewContent,
  mergeAdditionalImages,
  needsAdditionalImagesRepair,
} from "@/convex/productImageRepair";

const STORAGE = (id: string) =>
  `https://dutiful-fox-804.convex.cloud/api/storage/${id}`;

const PRIMARY = STORAGE("primary-0001");
const VIEW_A = STORAGE("view-a-0002");
const VIEW_B = STORAGE("view-b-0003");
const VIEW_C = STORAGE("view-c-0004");
const VIEW_D = STORAGE("view-d-0005");

describe("content hash — the same photograph is never stored twice", () => {
  it("is deterministic for identical bytes", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(contentHash(bytes)).toBe(contentHash(bytes));
  });

  it("differs for different bytes", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(contentHash(a)).not.toBe(contentHash(b));
  });

  it("returns a stable 8-character hex id", () => {
    expect(contentHash(new Uint8Array([9, 9, 9]))).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("additional image repair detection", () => {
  it("flags an empty gallery as needing repair", () => {
    expect(needsAdditionalImagesRepair([], PRIMARY)).toBe(true);
  });

  it("flags a blank slot", () => {
    expect(needsAdditionalImagesRepair(["   "], PRIMARY)).toBe(true);
  });

  it("flags a duplicate view", () => {
    expect(needsAdditionalImagesRepair([VIEW_A, VIEW_A], PRIMARY)).toBe(true);
  });

  it("flags the front image repeated as a thumbnail", () => {
    expect(needsAdditionalImagesRepair([PRIMARY], PRIMARY)).toBe(true);
  });

  it("flags a third-party (unverified) URL", () => {
    expect(
      needsAdditionalImagesRepair(["https://example.com/dolo.jpg"], PRIMARY),
    ).toBe(true);
  });

  it("accepts verified, distinct views", () => {
    expect(needsAdditionalImagesRepair([VIEW_A, VIEW_B], PRIMARY)).toBe(false);
  });
});

describe("merging views across a re-resolve", () => {
  it("de-duplicates and keeps fresh views first", () => {
    expect(mergeAdditionalImages([VIEW_B], [VIEW_A, VIEW_B], PRIMARY)).toEqual([
      VIEW_A,
      VIEW_B,
    ]);
  });

  it("never repeats the primary image", () => {
    expect(mergeAdditionalImages([], [PRIMARY, VIEW_A], PRIMARY)).toEqual([
      VIEW_A,
    ]);
  });

  it("drops unverified third-party URLs", () => {
    expect(
      mergeAdditionalImages(
        ["https://pharmeasy.in/dam/old.jpg"],
        [VIEW_A],
        PRIMARY,
      ),
    ).toEqual([VIEW_A]);
  });

  it(`caps the gallery at ${MAX_PRODUCT_IMAGES} images including the front`, () => {
    const merged = mergeAdditionalImages(
      [VIEW_C, VIEW_D],
      [VIEW_A, VIEW_B, VIEW_C],
      PRIMARY,
    );
    // One front packshot plus four thumbnails — never a fifth extra view.
    expect(merged).toEqual([VIEW_A, VIEW_B, VIEW_C, VIEW_D]);
    expect(merged.length).toBe(MAX_PRODUCT_IMAGES - 1);
  });

  it("drops a stored view that repeats the picture of one already kept", () => {
    // Two URLs of the same photograph would render as two identical thumbnails.
    const hashes = new Map([
      [VIEW_A, "hash-front"],
      [VIEW_B, "hash-front"],
      [VIEW_C, "hash-back"],
    ]);
    expect(
      mergeAdditionalImages([VIEW_A, VIEW_B, VIEW_C], [], PRIMARY, hashes),
    ).toEqual([VIEW_A, VIEW_C]);
  });

  it("spots a repeated view from the stored bytes", () => {
    expect(hasDuplicateViewContent(["a", "b", "a"])).toBe(true);
    expect(hasDuplicateViewContent(["a", "b", "c"])).toBe(false);
    expect(hasDuplicateViewContent([])).toBe(false);
  });

  it("keeps an existing verified view when a re-resolve finds nothing new", () => {
    expect(mergeAdditionalImages([VIEW_A, VIEW_B], [], PRIMARY)).toEqual([
      VIEW_A,
      VIEW_B,
    ]);
  });
});

describe("stored image audit — what needs re-resolving", () => {
  const row = (over: Partial<Parameters<typeof auditProductImage>[0]>) => ({
    imageUrl: PRIMARY,
    additionalImages: [VIEW_A, VIEW_B],
    imageUrlSource:
      "https://cdn01.pharmeasy.in/dam/productsnowatermark/059346/dolo-650mg-strip-of-15-tablets-front-2-non-watermark.jpg",
    ...over,
  });

  it("passes a verified packshot with a clean gallery and source", () => {
    expect(auditProductImage(row({})).needsFix).toBe(false);
  });

  it("treats a product with a single genuine view as healthy", () => {
    // Plenty of real products genuinely have only one packshot online.
    expect(auditProductImage(row({ additionalImages: [] })).needsFix).toBe(false);
  });

  it("flags a missing or placeholder image", () => {
    expect(auditProductImage(row({ imageUrl: "" })).reason).toBe("missing");
    expect(
      auditProductImage(row({ imageUrl: "data:image/svg+xml,%3Csvg%3E" })).reason,
    ).toBe("placeholder");
  });

  it("flags a third-party URL", () => {
    expect(
      auditProductImage(
        row({ imageUrl: "https://upload.wikimedia.org/x/dolo-650.png" }),
      ).reason,
    ).toBe("third-party");
  });

  it("flags a gallery that repeats the front image or an unverified URL", () => {
    expect(
      auditProductImage(row({ additionalImages: [PRIMARY] })).reason,
    ).toBe("broken-gallery");
    expect(
      auditProductImage(row({ additionalImages: [VIEW_A, VIEW_A] })).reason,
    ).toBe("broken-gallery");
    expect(
      auditProductImage(
        row({ additionalImages: ["https://pharmeasy.in/dam/old.jpg"] }),
      ).reason,
    ).toBe("broken-gallery");
  });

  it("flags a packshot stored from a person/hand-held/lifestyle source", () => {
    const instagram = auditProductImage(
      row({ imageUrlSource: "https://scontent.cdninstagram.com/v/x/dolo-650.jpg" }),
    );
    expect(instagram.needsFix).toBe(true);
    expect(instagram.reason).toBe("suspicious-source");
    expect(instagram.suspiciousSource).toContain("cdninstagram");

    expect(
      auditProductImage(
        row({ imageUrlSource: "https://example.com/dolo-650-in-hand-photo.jpg" }),
      ).reason,
    ).toBe("suspicious-source");
  });

  it("treats missing provenance as unknown rather than suspicious", () => {
    // Images stored before provenance was recorded must not be reported as
    // lifestyle photos; they are simply unaudited.
    expect(
      auditProductImage(row({ imageUrlSource: undefined })).needsFix,
    ).toBe(false);
  });
});

describe("verified image recognition", () => {
  it("accepts a Convex-storage URL", () => {
    expect(isVerifiedProductImage(STORAGE("abc"))).toBe(true);
  });

  it("rejects a generated placeholder", () => {
    expect(isVerifiedProductImage("data:image/svg+xml;base64,AAAA")).toBe(false);
  });

  it("rejects a third-party URL", () => {
    expect(isVerifiedProductImage("https://upload.wikimedia.org/x.jpg")).toBe(
      false,
    );
  });
});
