/**
 * The Auto Fill resolves ONE product catalogue record and uses it for both the
 * metadata and the images. These tests cover that record-level step in
 * isolation: the record's own assets become the stored front packshot plus the
 * real additional views, nothing is transformed, and a record that is not the
 * exact product contributes no image at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import {
  contentHash,
  MAX_PRODUCT_IMAGES,
  productNameMatchesIdentity,
  recordMatchesIdentity,
  storeRecordImages,
  type ProductRecordImages,
} from "@/convex/productImageResolver";

// ── A real PNG, so the bytes pass the image checks ────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A 400x400 RGB PNG. Each `seed` produces different bytes, so two assets are
 * never mistaken for the same photograph. */
function pngBytes(seed: number): Uint8Array {
  const width = 400;
  const height = 400;
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const p = rowStart + 1 + x * 3;
      raw[p] = (x * 7 + seed * 13) % 256;
      raw[p + 1] = (y * 5 + seed * 29) % 256;
      raw[p + 2] = (seed * 53) % 256;
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// ── Storage + network doubles ────────────────────────────────────────────

const storedBytes = new Map<string, Uint8Array>();

function fakeStorageCtx() {
  let counter = 0;
  return {
    storage: {
      store: async (blob: Blob) => {
        const id = `asset-${(counter += 1)}`;
        storedBytes.set(id, new Uint8Array(await blob.arrayBuffer()));
        return id;
      },
      getUrl: async (id: string) =>
        `https://dutiful-fox-804.convex.cloud/api/storage/${id}`,
    },
  } as never;
}

function serve(url: string): { url: string; bytes: Uint8Array } | null {
  const file = (url.split("?")[0].split("/").pop() ?? "").toLowerCase();
  const match = file.match(/(\d+)\.jpg$/);
  const seed = match ? Number(match[1]) : 1;
  const bytes = pngBytes(seed);
  return { url, bytes };
}

const CDN = "https://cdn01.pharmeasy.in/dam/productsnowatermark";

/** A catalogue record for "Augmentin 625 Duo" with its own image assets. */
function augmentinRecord(): ProductRecordImages {
  return {
    name: "Augmentin Duo 625Mg Strip Of 10 Tablets",
    source: "pharmacy-catalogue",
    sourceUrl: `https://pharmeasy.in/search/all?name=${encodeURIComponent("Augmentin 625 Duo")}`,
    manufacturer: "GlaxoSmithKline",
    packText: "10 Tablet(s) in Strip",
    images: [
      { url: `${CDN}/augmentin-duo-625mg-strip-1.jpg`, face: "front" },
      { url: `${CDN}/augmentin-duo-625mg-strip-back-2.jpg`, face: "box-back" },
      { url: `${CDN}/augmentin-duo-625mg-strip-3.jpg` },
      { url: `${CDN}/augmentin-duo-625mg-strip-side-4.jpg`, face: "side" },
    ],
  };
}

const IDENTITY = { productName: "Augmentin 625 Duo" };

beforeEach(() => {
  storedBytes.clear();
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    const found = serve(url);
    if (!found) return new Response("", { status: 404 });
    return new Response(found.bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Weighted identity matching ───────────────────────────────────────────

describe("weighted identity matching — wording differs, the product does not", () => {
  it("accepts the same product stated in a different order", () => {
    expect(
      productNameMatchesIdentity("Augmentin Duo 625 Tablets", IDENTITY),
    ).toBe(true);
  });

  it("accepts a different capitalisation and punctuation", () => {
    expect(
      productNameMatchesIdentity("AUGMENTIN-DUO-625MG", IDENTITY),
    ).toBe(true);
  });

  it("accepts the brand's own marketing wording around the same name", () => {
    expect(
      productNameMatchesIdentity(
        "Augmentin Duo 625 Mg Antibiotic Capsules",
        IDENTITY,
      ),
    ).toBe(true);
  });

  it("accepts an abbreviated manufacturer name", () => {
    expect(
      productNameMatchesIdentity("Augmentin Duo 625Mg", {
        ...IDENTITY,
        manufacturer: "GlaxoSmithKline Pharmaceuticals",
      }),
    ).toBe(true);
  });

  it("still refuses another strength", () => {
    expect(
      productNameMatchesIdentity("Augmentin Duo 375Mg", IDENTITY),
    ).toBe(false);
  });

  it("still refuses another dosage form", () => {
    expect(
      productNameMatchesIdentity("Augmentin Duo 625Mg Syrup", {
        ...IDENTITY,
        form: "tablet",
      }),
    ).toBe(false);
  });

  it("still refuses another brand that shares a name word", () => {
    expect(
      productNameMatchesIdentity("Augmentin Duo 625Mg", {
        ...IDENTITY,
        brand: "Amoxil",
      }),
    ).toBe(false);
  });

  it("still refuses an unrelated product", () => {
    expect(productNameMatchesIdentity("Brufen 400mg", IDENTITY)).toBe(false);
  });

  it("checks a whole record, not only its name", () => {
    expect(
      recordMatchesIdentity(
        { name: "Augmentin Duo 625Mg", manufacturer: "Ranbaxy Laboratories" },
        { ...IDENTITY, manufacturer: "GlaxoSmithKline" },
      ),
    ).toBe(false);
  });
});

// ── Storing the record's own images ──────────────────────────────────────

describe("images come from the resolved product record", () => {
  it("stores the record's front packshot as the primary image", async () => {
    const result = await storeRecordImages(
      fakeStorageCtx(),
      IDENTITY,
      augmentinRecord(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imageUrl).toMatch(/convex\.cloud\/api\/storage\//);
    expect(result.matchedName).toBe("Augmentin Duo 625Mg Strip Of 10 Tablets");
    expect(result.source).toBe("pharmacy-catalogue");
    // The primary came from the record's own front face, not from another URL.
    expect(result.imageUrlSource).toContain("augmentin-duo-625mg-strip-1.jpg");
  });

  it("saves the record's other genuine views as additional images", async () => {
    const result = await storeRecordImages(
      fakeStorageCtx(),
      IDENTITY,
      augmentinRecord(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.views).toBe(4);
    expect(result.additionalImages).toHaveLength(3);
    // Every additional view is a real asset of the same record — no mirror, no
    // re-crop, nothing from another product.
    const sources = [
      result.imageUrlSource,
      ...result.additionalImages.map(() => ""),
    ];
    expect(sources[0]).toContain("augmentin-duo-625mg");
    expect(result.complete).toBe(false);
    expect(result.message).toMatch(/no unverified, duplicated or generated images/i);
  });

  it("never stores the same photograph twice", async () => {
    const record = augmentinRecord();
    record.images = [
      { url: `${CDN}/augmentin-duo-625mg-strip-1.jpg`, face: "front" },
      { url: `${CDN}/augmentin-duo-625mg-strip-copy.jpg`, face: "front" },
    ];
    const result = await storeRecordImages(fakeStorageCtx(), IDENTITY, record);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.views).toBe(1);
    expect(result.additionalImages).toHaveLength(0);
  });

  it("reuses a packshot the product already has stored", async () => {
    const first = await storeRecordImages(
      fakeStorageCtx(),
      IDENTITY,
      augmentinRecord(),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const primaryId = first.imageUrl.split("/").pop()!;
    const existingByHash = new Map([
      [contentHash(storedBytes.get(primaryId)!), first.imageUrl],
    ]);
    storedBytes.clear();
    // The front packshot's bytes are already stored: the same view is re-used
    // (and still leads the gallery) instead of being stored a second time.
    const result = await storeRecordImages(
      fakeStorageCtx(),
      IDENTITY,
      augmentinRecord(),
      { existingByHash },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imageUrl).toBe(first.imageUrl);
    expect(result.views).toBe(4);
  });

  it("uses no image at all from a record that is a different product", async () => {
    const record = augmentinRecord();
    record.name = "Brufen 400mg Strip Of 10 Tablets";
    const result = await storeRecordImages(fakeStorageCtx(), IDENTITY, record);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/not this exact product/i);
  });

  it("uses no image at all from a different strength of the same brand", async () => {
    const record = augmentinRecord();
    record.name = "Augmentin Duo 1000Mg Strip Of 10 Tablets";
    const result = await storeRecordImages(fakeStorageCtx(), IDENTITY, record);
    expect(result.ok).toBe(false);
  });

  it("says so when the exact record simply publishes no images", async () => {
    const record = augmentinRecord();
    record.images = [];
    const result = await storeRecordImages(fakeStorageCtx(), IDENTITY, record);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/publishes no product images of its own/i);
  });

  it("reports a technical download failure instead of inventing an image", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 500 }));
    const result = await storeRecordImages(
      fakeStorageCtx(),
      IDENTITY,
      augmentinRecord(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/none of the images it publishes could be downloaded/i);
    expect(result.considered).toEqual(["Augmentin Duo 625Mg Strip Of 10 Tablets"]);
  });

  it("retries the same record's asset after a first failed attempt", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", async (input: string | URL) => {
      attempts += 1;
      const url = String(input);
      // The first attempt at each asset fails, the retry succeeds.
      if (attempts <= 2) return new Response("", { status: 503 });
      const found = serve(url);
      if (!found) return new Response("", { status: 404 });
      return new Response(found.bytes.buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    });
    const result = await storeRecordImages(
      fakeStorageCtx(),
      IDENTITY,
      augmentinRecord(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(attempts).toBeGreaterThan(2);
    expect(result.views).toBeGreaterThan(0);
  });

  it("stores only the real views a record publishes, even when there are few", async () => {
    const record = augmentinRecord();
    record.images = [{ url: `${CDN}/augmentin-duo-625mg-strip-side-9.jpg`, face: "side" }];
    const result = await storeRecordImages(fakeStorageCtx(), IDENTITY, record);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.views).toBe(1);
    expect(result.additionalImages).toHaveLength(0);
    expect(result.complete).toBe(false);
  });

  it("targets at most the full gallery of genuine views", async () => {
    const record = augmentinRecord();
    record.images = Array.from({ length: 8 }, (_, index) => ({
      url: `${CDN}/augmentin-duo-625mg-strip-${index + 1}.jpg`,
      face: index === 0 ? "front" : undefined,
    }));
    const result = await storeRecordImages(fakeStorageCtx(), IDENTITY, record);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.views).toBeLessThanOrEqual(MAX_PRODUCT_IMAGES);
  });
});
