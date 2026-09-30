/**
 * The product catalogue sources the Auto Fill asks, in priority order.
 *
 * The earlier resolver asked ONE pharmacy catalogue and treated whatever came
 * back as the answer. That is wrong in two ways:
 *
 *   1. An empty, blocked or unparseable response is NOT evidence that a product
 *      does not exist. These sites render their search results in the browser
 *      and answer a server-side request with an empty shell, a 404 or a
 *      challenge page. Reading that as "no such product" is how real products
 *      were reported as unverifiable.
 *   2. One source stocking a product is a fact about that source, not about the
 *      product. A medicine that PharmEasy does not list may still be listed by
 *      the brand's own site, and a product the brand lists may not be in any
 *      catalogue at all.
 *
 * So this module is only responsible for TALKING to a source and saying exactly
 * what came back: real product data, nothing usable, or an outright block. The
 * decision about whether a record is the exact product lives with the resolver,
 * which owns the identity rules.
 *
 * A source that cannot serve data is remembered for a while, so re-running Auto
 * Fill for a product does not re-request a site that has already refused.
 */
import { getText, SITE_TIMEOUT_MS } from "./productImageResolver";

/** Every source the cascade may ask, in the order it may ask them. */
export type SourceId = "apollo" | "tata1mg" | "netmeds" | "pharmeasy" | "official";

/** How a source answered. Only "ok" means it served usable product data. */
export type SourceStatus = "ok" | "no-data" | "blocked" | "error";

export type SourceProbe = {
  id: SourceId;
  label: string;
  status: SourceStatus;
  /** What happened, in plain words, for the admin's audit trail. */
  detail: string;
  searchUrl: string | null;
  /** The response body, when it carried usable product data. */
  html: string | null;
};

type SourceDefinition = {
  id: SourceId;
  /** Name shown to the admin. */
  label: string;
  searchUrl(query: string): string;
  /** A source with its own site search rather than a fixed catalogue. */
  brandSite?: boolean;
};

export const CATALOGUE_SOURCES: SourceDefinition[] = [
  {
    id: "apollo",
    label: "Apollo Pharmacy",
    searchUrl: (query) =>
      `https://www.apollopharmacy.in/search/?searchText=${encodeURIComponent(query)}`,
  },
  {
    id: "tata1mg",
    label: "Tata 1mg",
    searchUrl: (query) =>
      `https://www.tata1mg.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "netmeds",
    label: "Netmeds",
    searchUrl: (query) =>
      `https://www.netmeds.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "pharmeasy",
    label: "PharmEasy",
    searchUrl: (query) =>
      `https://pharmeasy.in/search/all?name=${encodeURIComponent(query)}`,
  },
];

/** The brand's own product page is the last structured source, not a catalogue. */
export const OFFICIAL_SOURCE: SourceDefinition = {
  id: "official",
  label: "Official manufacturer",
  searchUrl: () => "",
  brandSite: true,
};

export const SOURCE_LABELS: Record<SourceId, string> = {
  apollo: "Apollo Pharmacy",
  tata1mg: "Tata 1mg",
  netmeds: "Netmeds",
  pharmeasy: "PharmEasy",
  official: OFFICIAL_SOURCE.label,
};

/**
 * A source that has already refused is not asked again for a while. This is what
 * keeps a dead source from costing a request on every single Auto Fill.
 */
const BLOCKED_TTL_MS = 30 * 60_000;
const blockedMemory = new Map<SourceId, { at: number; reason: string }>();

/** Test seam: forget which sources are currently refusing. */
export function resetSourceMemory(): void {
  blockedMemory.clear();
}

/** A product-detail link inside a search response. */
const PRODUCT_LINK = /href=["'][^"']*\/(?:products?|medicines?|brands?|items?|dp|store\/p)\//gi;

/**
 * Does this response actually contain product data, or is it the empty shell a
 * browser-rendered site answers with?
 *
 * A shell is a page with chrome but no product records: no embedded state, no
 * structured data and no product links. It is reported as "no data", never as
 * "product not found".
 */
function hasProductData(html: string): boolean {
  const embeddedState =
    html.includes("__NEXT_DATA__") ||
    html.includes("__NUXT__") ||
    /<script[^>]+application\/(?:ld\+)?json[^>]*>/i.test(html);
  if (embeddedState) {
    // A state blob is only useful if it is more than an empty object.
    const blobs = html.match(
      /<script[^>]+application\/(?:ld\+)?json[^>]*>([\s\S]{40,}?)<\/script>/gi,
    );
    if (blobs && blobs.length > 0) return true;
  }
  const links = html.match(PRODUCT_LINK);
  return (links?.length ?? 0) >= 3;
}

/** Ask one catalogue what it has for a product name. */
export async function probeCatalogueSource(
  source: SourceDefinition,
  query: string,
): Promise<SourceProbe> {
  const searchUrl = source.searchUrl(query);
  const remembered = blockedMemory.get(source.id);
  if (remembered && Date.now() - remembered.at < BLOCKED_TTL_MS) {
    return {
      id: source.id,
      label: source.label,
      status: "blocked",
      detail: remembered.reason,
      searchUrl,
      html: null,
    };
  }

  let html: string | null;
  try {
    html = await getText(searchUrl, "text/html,application/xhtml+xml", SITE_TIMEOUT_MS);
  } catch {
    return {
      id: source.id,
      label: source.label,
      status: "error",
      detail: "the request failed before a response arrived",
      searchUrl,
      html: null,
    };
  }

  if (!html) {
    const detail = "the site did not answer a server-side request";
    blockedMemory.set(source.id, { at: Date.now(), reason: detail });
    return { id: source.id, label: source.label, status: "blocked", detail, searchUrl, html: null };
  }

  // A 404/challenge page is still returned with a body by these sites, so the
  // body itself decides: no product data means this source cannot serve the
  // record, which is not the same as the product not existing.
  if (!hasProductData(html)) {
    const detail =
      "search results are rendered in the browser, so the response carried no product records";
    blockedMemory.set(source.id, { at: Date.now(), reason: detail });
    return { id: source.id, label: source.label, status: "no-data", detail, searchUrl, html: null };
  }

  blockedMemory.delete(source.id);
  return {
    id: source.id,
    label: source.label,
    status: "ok",
    detail: "product records returned",
    searchUrl,
    html,
  };
}
