import { describe, expect, it } from "vitest";
import {
  contentHash,
  isVerifiedProductImage,
  MAX_PRODUCT_IMAGES,
} from "@/convex/productImageResolver";
import {
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
    expect(merged).toEqual([VIEW_A, VIEW_B, VIEW_C]);
    expect(merged.length).toBe(MAX_PRODUCT_IMAGES - 1);
  });

  it("keeps an existing verified view when a re-resolve finds nothing new", () => {
    expect(mergeAdditionalImages([VIEW_A, VIEW_B], [], PRIMARY)).toEqual([
      VIEW_A,
      VIEW_B,
    ]);
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
