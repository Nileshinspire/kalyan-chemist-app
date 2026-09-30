/**
 * The multi-source cascade: every configured pharmacy catalogue is asked in
 * priority order, a source that cannot answer is reported and stepped over
 * instead of being read as "no such product", a verified record is cached and
 * reused, and the identity rules still refuse a wrong variant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CATALOGUE_SOURCES,
  SOURCE_LABELS,
  probeCatalogueSource,
  resetSourceMemory,
} from "@/convex/productCatalogSources";
import {
  catalogueProductMatchesIdentity,
  parseGenericProduct,
  type CatalogueProduct,
} from "@/convex/productMetadataResolver";
import {
  catalogRecordKey,
  isUsableCachedRecord,
  type CachedCatalogRecord,
} from "@/convex/productCatalogCache";
import { strengthFromProductName } from "@/convex/productBackfill";
import { NO_CONFIDENT_MATCH_MESSAGE } from "@/convex/productInfo";
import type { ProductIdentity } from "@/convex/productImageResolver";

const BROWSER_HEADERS = { "content-type": "text/html" };

function html(body: string) {
  return new Response(body, { status: 200, headers: BROWSER_HEADERS });
}

/** A catalogue search page that carries its products as embedded state. */
function cataloguePage(name: string, manufacturer: string) {
  const state = {
    props: {
      pageProps: {
        products: [
          {
            name,
            manufacturer,
            consumerBrandName: name.split(" ")[0],
            compositions: [{ name: "Paracetamol 650Mg" }],
            measurementUnit: "15 Tablet(s) in Strip",
            damImages: [
              { url: `https://cdn01.pharmeasy.in/dam/productsnowatermark/${name}-front.jpg`, face: "front" },
            ],
            slug: name.toLowerCase().replace(/\s+/g, "-"),
          },
        ],
      },
    },
  };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    state,
  )}</script></body></html>`;
}

beforeEach(() => {
  resetSourceMemory();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSourceMemory();
});

describe("the configured sources, in priority order", () => {
  it("asks the big Indian pharmacies first and the brand site last", () => {
    expect(CATALOGUE_SOURCES.map((source) => source.id)).toEqual([
      "apollo",
      "tata1mg",
      "netmeds",
      "pharmeasy",
    ]);
    expect(SOURCE_LABELS.apollo).toBe("Apollo Pharmacy");
    expect(SOURCE_LABELS.tata1mg).toBe("Tata 1mg");
    expect(SOURCE_LABELS.netmeds).toBe("Netmeds");
    expect(SOURCE_LABELS.pharmeasy).toBe("PharmEasy");
    expect(SOURCE_LABELS.official).toBe("Official manufacturer");
  });

  it("searches each source at its own search URL", () => {
    const apollo = CATALOGUE_SOURCES[0];
    expect(apollo.searchUrl("Dolo 650")).toContain(
      `apollopharmacy.in/search/?searchText=${encodeURIComponent("Dolo 650")}`,
    );
    expect(CATALOGUE_SOURCES[3].searchUrl("Dolo 650")).toContain(
      `pharmeasy.in/search/all?name=${encodeURIComponent("Dolo 650")}`,
    );
  });
});

describe("a source that cannot answer is reported, never treated as a verdict", () => {
  it("reads a browser-rendered shell as no data, not as no product", async () => {
    vi.stubGlobal(
      "fetch",
      async () => html("<html><body><div id='root'></div><script src='/app.js'></script></body></html>"),
    );
    const probe = await probeCatalogueSource(CATALOGUE_SOURCES[0], "Dolo 650");
    expect(probe.status).toBe("no-data");
    expect(probe.html).toBeNull();
    expect(probe.detail).toMatch(/rendered in the browser/i);
  });

  it("reads an unanswered request as blocked", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    const probe = await probeCatalogueSource(CATALOGUE_SOURCES[0], "Dolo 650");
    expect(probe.status).toBe("blocked");
    expect(probe.detail).toMatch(/did not answer/i);
  });

  it("asks a blocked source once, not on every Auto Fill", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return new Response("", { status: 404 });
    });
    await probeCatalogueSource(CATALOGUE_SOURCES[0], "Dolo 650");
    await probeCatalogueSource(CATALOGUE_SOURCES[0], "Dolo 650");
    await probeCatalogueSource(CATALOGUE_SOURCES[0], "Azithral 500");
    expect(calls).toBe(1);
  });

  it("accepts a source that really published product records", async () => {
    vi.stubGlobal("fetch", async () => html(cataloguePage("Dolo 650Mg Strip Of 15 Tablets", "MICRO LABS")));
    const probe = await probeCatalogueSource(CATALOGUE_SOURCES[3], "Dolo 650");
    expect(probe.status).toBe("ok");
    expect(probe.html).toContain("__NEXT_DATA__");
  });

  it("accepts a source that only ships product links", async () => {
    const links = [1, 2, 3]
      .map((n) => `<a href="/product/dolo-650-${n}">Dolo 650</a>`)
      .join("");
    vi.stubGlobal("fetch", async () => html(`<html><body>${links}</body></html>`));
    const probe = await probeCatalogueSource(CATALOGUE_SOURCES[1], "Dolo 650");
    expect(probe.status).toBe("ok");
  });
});

describe("reading a record from any source's own payload", () => {
  it("reads the identity fields a source states, under its own field names", () => {
    const product = parseGenericProduct(
      {
        name: "Dolo 650 Tablet",
        brand: "Dolo",
        manufacturer: "Micro Labs",
        composition: "Paracetamol 650mg",
        packSize: "15 tablets",
        sku: "DL-650",
        prescriptionRequired: false,
      },
      "Tata 1mg",
    )!;
    expect(product.productName).toBe("Dolo 650 Tablet");
    expect(product.manufacturer).toBe("Micro Labs");
    expect(product.composition).toBe("Paracetamol 650mg");
    expect(product.packSize).toBe("15 tablets");
    expect(product.sku).toBe("DL-650");
    expect(product.prescriptionRequired).toBe(false);
    expect(product.strength).toBe("650 mg");
  });

  it("never invents a field the record does not state", () => {
    const product = parseGenericProduct({ name: "Some Device" }, "Tata 1mg")!;
    expect(product.composition).toBeNull();
    expect(product.manufacturer).toBeNull();
    expect(product.prescriptionRequired).toBeNull();
    expect(product.sku).toBeNull();
  });

  it("returns nothing for a payload with no product name", () => {
    expect(parseGenericProduct({ price: 12 }, "Tata 1mg")).toBeNull();
  });
});

describe("the cascade still refuses a wrong variant", () => {
  const identity: ProductIdentity = { productName: "Augmentin 625 Duo" };
  const product: CatalogueProduct = {
    productName: "Augmentin Duo 625Mg Strip Of 10 Tablets",
    brand: "Augmentin",
    manufacturer: "Glaxosmithkline",
    composition: "Amoxicillin 500mg + Clavulanic acid 125mg",
    strength: "625 mg",
    form: "tablet",
    packSize: "10 Tablet(s) in Strip",
    prescriptionRequired: true,
    sku: null,
    slug: null,
    source: "pharmacy-catalogue",
    sourceUrl: null,
  };

  it("accepts the exact record", () => {
    expect(catalogueProductMatchesIdentity(product, identity)).toBe(true);
  });

  it("refuses Dolo 500 for Dolo 650, and the other way round", () => {
    expect(
      catalogueProductMatchesIdentity(product, { productName: "Augmentin 500 Duo" }),
    ).toBe(false);
  });

  it("refuses a different dosage form", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 625 Duo",
        form: "syrup",
      }),
    ).toBe(false);
  });

  it("refuses a different pack when the admin stated one", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 625 Duo",
        packSize: "15 tablets",
      }),
    ).toBe(false);
  });

  it("refuses a different brand that shares a name word", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 625 Duo",
        brand: "Amoxil",
      }),
    ).toBe(false);
  });
});

describe("the verified record cache", () => {
  const record: CachedCatalogRecord = {
    cacheKey: "dolo 650|650mg",
    enteredName: "Dolo 650",
    resolvedName: "Dolo 650Mg Strip Of 15 Tablets",
    brand: "Dolo",
    manufacturer: "Micro Labs",
    composition: "Paracetamol 650mg",
    strength: "650 mg",
    form: "tablet",
    packSize: "15 Tablet(s) in Strip",
    prescriptionRequired: false,
    sku: null,
    source: "PharmEasy",
    sourceUrl: "https://pharmeasy.in/search/all?name=Dolo%20650",
    productPageUrl: null,
    recordImages: ["https://cdn01.pharmeasy.in/dam/productsnowatermark/dolo-650-front.jpg"],
    packText: "15 Tablet(s) in Strip",
    recordManufacturer: "Micro Labs",
    checkedAt: Date.now(),
    updatedAt: Date.now(),
  };

  it("keys a product the same however it is typed", () => {
    const spaced = catalogRecordKey({
      productName: "Dolo 650",
      strength: strengthFromProductName("Dolo 650"),
    });
    const hyphenated = catalogRecordKey({
      productName: "dolo-650",
      strength: strengthFromProductName("dolo-650"),
    });
    const shouted = catalogRecordKey({ productName: "DOLO 650" });
    expect(spaced).toBe(hyphenated);
    expect(spaced).toBe(shouted);
  });

  it("keeps variants in separate rows", () => {
    const fiveHundred = catalogRecordKey({ productName: "Dolo 500" });
    const sixFifty = catalogRecordKey({ productName: "Dolo 650" });
    expect(fiveHundred).not.toBe(sixFifty);
  });

  it("keeps a stated pack apart from an unstated one", () => {
    expect(catalogRecordKey({ productName: "Dolo 650", packSize: "10 tablets" })).not.toBe(
      catalogRecordKey({ productName: "Dolo 650" }),
    );
  });

  it("re-uses a verified record instead of searching again", () => {
    expect(isUsableCachedRecord(record, { productName: "dolo 650" })).toBe(true);
  });

  it("refuses a cached record for a different product", () => {
    expect(isUsableCachedRecord(record, { productName: "Dolo 325" })).toBe(false);
  });

  it("refuses a cached record whose strength contradicts the product asked for", () => {
    expect(
      isUsableCachedRecord(record, { productName: "Dolo 650", strength: "500 mg" }),
    ).toBe(false);
  });

  it("refuses a cached record that has no image assets to store", () => {
    expect(
      isUsableCachedRecord({ ...record, recordImages: [] }, { productName: "Dolo 650" }),
    ).toBe(false);
  });

  it("refreshes a record that never learned the form its own name states", () => {
    const formless = {
      ...record,
      enteredName: "Cetaphil Gentle Skin Cleanser 118 ml",
      resolvedName: "Cetaphil Gentle Skin Cleanser | 118 Ml",
      form: null,
    };
    expect(
      isUsableCachedRecord(formless, { productName: "Cetaphil Gentle Skin Cleanser 118 ml" }),
    ).toBe(false);
  });

  it("keeps a record whose product genuinely states no form", () => {
    expect(
      isUsableCachedRecord(record, { productName: "Dolo 650" }),
    ).toBe(true);
  });

  it("refuses a record older than the freshness window", () => {
    const stale = { ...record, updatedAt: Date.now() - 31 * 24 * 60 * 60_000 };
    expect(isUsableCachedRecord(stale, { productName: "Dolo 650" })).toBe(false);
  });

  it("refuses nothing at all", () => {
    expect(isUsableCachedRecord(null, { productName: "Dolo 650" })).toBe(false);
  });
});

describe("the failure message names the sources that were checked", () => {
  it("does not claim the product does not exist without saying what was searched", () => {
    expect(NO_CONFIDENT_MATCH_MESSAGE).toMatch(/every configured source was searched/i);
    for (const label of ["Apollo Pharmacy", "Tata 1mg", "Netmeds", "PharmEasy"]) {
      expect(NO_CONFIDENT_MATCH_MESSAGE).toContain(label);
    }
  });
});
