/**
 * Requirement: a product image must be stored at the highest resolution its own
 * source publishes, without ever changing which picture it is.
 *
 * These tests cover the two halves of that rule: recognising the URL of a
 * source's larger variant (and refusing to guess on any host that has not been
 * verified), and accepting a full-resolution re-fetch only when it is strictly
 * bigger and keeps the same framing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import {
  downloadFullResolutionAsset,
  originalAssetUrl,
} from "@/convex/productImageResolver";

// ── Real PNG bytes at a chosen size ───────────────────────────────────────

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

function pngBytes(width: number, height: number): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1);
    for (let x = 0; x < width; x += 1) {
      const p = rowStart + 1 + x * 3;
      raw[p] = (x * 7) % 256;
      raw[p + 1] = (y * 5) % 256;
      raw[p + 2] = 128;
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const RENDER_600 = "https://cdn01.pharmeasy.in/dam/products_otc/V90675/device-2-1771400619.jpg?dim=600x0&q=80";
const ORIGINAL_1500 = "https://cdn01.pharmeasy.in/dam/products_otc/V90675/device-2-1771400619.jpg";

beforeEach(() => {
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    if (url.includes("?dim=")) {
      return new Response(pngBytes(600, 600).buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (url.includes("cdn01.pharmeasy.in")) {
      return new Response(pngBytes(1500, 1500).buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (url.endsWith(".full.jpg")) {
      return new Response(pngBytes(1088, 822).buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (url.endsWith(".400.jpg")) {
      return new Response(pngBytes(400, 302).buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response("", { status: 404 });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("originalAssetUrl", () => {
  it("finds the CDN's original behind a card-sized render", () => {
    expect(originalAssetUrl(RENDER_600)).toBe(ORIGINAL_1500);
  });

  it("leaves an already-original CDN asset alone", () => {
    expect(originalAssetUrl(ORIGINAL_1500)).toBeNull();
  });

  it("finds the full-size variant behind an open-database thumbnail", () => {
    expect(
      originalAssetUrl(
        "https://images.openproductsfacts.org/images/products/340/093/921/3385/front_fr.3.400.jpg",
      ),
    ).toBe(
      "https://images.openproductsfacts.org/images/products/340/093/921/3385/front_fr.3.full.jpg",
    );
  });

  it("never guesses a larger URL on an unverified host", () => {
    expect(originalAssetUrl("https://example.com/images/product.jpg")).toBeNull();
    expect(originalAssetUrl("https://cdn.example.com/p.jpg?w=200")).toBeNull();
    expect(originalAssetUrl("")).toBeNull();
    expect(originalAssetUrl(undefined)).toBeNull();
  });
});

describe("downloadFullResolutionAsset", () => {
  it("fetches the source's original asset rather than the 600px render", async () => {
    const asset = await downloadFullResolutionAsset(RENDER_600, { width: 600, height: 600 });
    expect(asset).not.toBeNull();
    expect(asset!.sourceUrl).toBe(ORIGINAL_1500);
    expect(asset!.width).toBe(1500);
    expect(asset!.height).toBe(1500);
    expect(asset!.contentType).toBe("image/jpeg");
  });

  it("accepts the asset when nothing is stored yet", async () => {
    const asset = await downloadFullResolutionAsset(RENDER_600, null);
    expect(asset?.width).toBe(1500);
  });

  it("refuses a fetch that is not actually bigger", async () => {
    const asset = await downloadFullResolutionAsset(RENDER_600, { width: 1500, height: 1500 });
    expect(asset).toBeNull();
  });

  it("refuses a different aspect ratio, so the picture cannot be re-cropped", async () => {
    // Stored 600x600 (square) vs a source asset answering 1500x1000.
    vi.stubGlobal("fetch", async (input: string | URL) => {
      const url = String(input);
      const bytes = url.includes("?dim=") ? pngBytes(600, 600) : pngBytes(1500, 1000);
      return new Response(bytes.buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    });
    const asset = await downloadFullResolutionAsset(RENDER_600, { width: 600, height: 600 });
    expect(asset).toBeNull();
  });

  it("falls back to the render when the original is not served", async () => {
    vi.stubGlobal("fetch", async (input: string | URL) => {
      const url = String(input);
      if (url.includes("?dim=")) {
        return new Response(pngBytes(600, 600).buffer as ArrayBuffer, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response("", { status: 404 });
    });
    const asset = await downloadFullResolutionAsset(RENDER_600, null);
    expect(asset).not.toBeNull();
    // Provenance records what was actually fetched: the render, in this case.
    expect(asset!.sourceUrl).toBe(RENDER_600);
    expect(asset!.width).toBe(600);
  });

  it("upgrades an open-database thumbnail to its full-size variant", async () => {
    const asset = await downloadFullResolutionAsset(
      "https://images.openproductsfacts.org/images/products/340/093/921/3385/front_fr.3.400.jpg",
      { width: 400, height: 302 },
    );
    expect(asset).not.toBeNull();
    expect(asset!.sourceUrl).toContain(".full.jpg");
    expect(asset!.width).toBe(1088);
  });
});
