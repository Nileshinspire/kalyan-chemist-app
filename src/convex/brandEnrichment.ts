import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side brand enrichment.
 *
 * Admin types a brand name; this action resolves the closest real company and
 * returns its logo, description and country. Nothing here is hardcoded per
 * brand, so a brand added next year resolves the same way.
 *
 * Source: Wikidata (entity identity, country of origin, official logo file)
 * and English Wikipedia (infobox logo, lead paragraph). Both are queried from
 * the Convex server, never from the browser, so no scraping happens client-side
 * and no credentials are involved.
 *
 * If the brand cannot be resolved *reliably* this throws, so the caller can
 * refuse to save an incomplete brand rather than invent metadata.
 */

const USER_AGENT = "KalyanChemist/1.0 (brand metadata enrichment)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIMEDIA_COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/**
 * Wikidata descriptions that mean "this is a trading company / manufacturer".
 * Used to reject homonyms — a brand name that is also a place, a person or a
 * film must never be accepted as a company.
 */
const COMPANY_HINT =
  /(\bcompan|\bcorporation|\bmanufactur|pharmaceut|\bpharma|\bdrug|\bbrand|enterprise|conglomerate|limited|\bholdings|conglomerate|industries|laborator|\blabs?\b|biotech|biolog|therapeut|\bhealth|consumer|\bfoods?\b|beverage|\bretail|\bsupplier|\bgroup\b|\binc\b|\bcorp\b|\bllc\b|\bplc\b|\bgmbh\b|\bco\.,|\bag\b)/i;

/** Wikidata properties used to resolve the country of origin. */
const P_COUNTRY_OF_ORIGIN = "P495";
const P_COUNTRY = "P17";
const P_HEADQUARTERS = "P159";
const P_LOGO = "P154";

type WikidataValue = { id?: string; text?: string; entityType?: string };

type SearchHit = {
  id: string;
  label?: string;
  description?: string;
};

async function wikidataGet(params: Record<string, string>) {
  const url = `${WIKIDATA_API}?${new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikidata request failed (${res.status})`);
  return res.json();
}

function entityValues(entity: any, property: string): WikidataValue[] {
  const claims = entity?.claims?.[property] ?? [];
  return claims
    .filter((c: any) => c?.mainsnak?.datavalue?.value)
    .map((c: any) => c.mainsnak.datavalue.value as WikidataValue);
}

function entityIds(entity: any, property: string): string[] {
  return entityValues(entity, property)
    .map((v) => v.id)
    .filter((id): id is string => typeof id === "string");
}

/** Normalise a label so "Sun Pharma" and "sun-pharma ltd." can be compared. */
function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Pick the candidate that is most likely to be the company the admin meant.
 * Requires a company-ish description, then prefers an exact label match and
 * otherwise the closest length so "Sun Pharma" resolves to
 * "Sun Pharmaceutical" rather than to an unrelated longer entry.
 */
function pickCandidate(query: string, hits: SearchHit[]): SearchHit | null {
  const wanted = normalizeLabel(query);
  const companies = hits.filter(
    (h) => h.label && h.description && COMPANY_HINT.test(h.description),
  );
  if (companies.length === 0) return null;

  const exact = companies.find((h) => normalizeLabel(h.label!) === wanted);
  if (exact) return exact;

  const startsWith = companies.find((h) =>
    normalizeLabel(h.label!).startsWith(wanted),
  );
  if (startsWith) return startsWith;

  return companies.reduce((best, current) => {
    const bestDistance = Math.abs(normalizeLabel(best.label!).length - wanted.length);
    const currentDistance = Math.abs(
      normalizeLabel(current.label!).length - wanted.length,
    );
    return currentDistance < bestDistance ? current : best;
  }, companies[0]);
}

/** Resolve a country QID to its English label. */
async function countryLabel(qid: string): Promise<string | null> {
  const data = await wikidataGet({
    action: "wbgetentities",
    ids: qid,
    props: "labels",
    languages: "en",
  });
  return data?.entities?.[qid]?.labels?.en?.value ?? null;
}

/**
 * Resolve the country of origin, most direct source first:
 * country of origin → country → country of the headquarters city.
 */
async function resolveCountry(entity: any): Promise<string | null> {
  const direct = [
    ...entityIds(entity, P_COUNTRY_OF_ORIGIN),
    ...entityIds(entity, P_COUNTRY),
  ];
  for (const qid of direct) {
    const label = await countryLabel(qid);
    if (label) return label;
  }

  for (const cityId of entityIds(entity, P_HEADQUARTERS).slice(0, 2)) {
    const city = await wikidataGet({
      action: "wbgetentities",
      ids: cityId,
      props: "claims",
    });
    const cityEntity = city?.entities?.[cityId];
    for (const qid of entityIds(cityEntity, P_COUNTRY).slice(0, 1)) {
      const label = await countryLabel(qid);
      if (label) return label;
    }
  }

  return null;
}

/** The English Wikipedia article title for a Wikidata item, if any. */
function englishArticleTitle(entity: any): string | null {
  const links = entity?.sitelinks ?? {};
  const site = links.enwiki ?? links.enwikinews ?? links.enwikiquote;
  return site?.title ?? null;
}

/**
 * Logo, preferring the article's infobox image (already a clean PNG) and
 * falling back to the official logo file from Wikidata.
 */
async function resolveLogo(entity: any, title: string | null): Promise<string | null> {
  if (title) {
    try {
      const url = `${WIKIPEDIA_API}?${new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        prop: "pageimages",
        piprop: "thumbnail",
        pithumbsize: "300",
        titles: title,
      })}`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.ok) {
        const data = await res.json();
        const pages = data?.query?.pages ?? {};
        const first = Object.values(pages)[0] as any;
        if (first?.thumbnail?.source) return first.thumbnail.source as string;
      }
    } catch {
      // Fall through to the Wikidata logo file.
    }
  }

  for (const file of entityValues(entity, P_LOGO)) {
    const name = file.text;
    if (name) {
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
        name,
      )}?width=300`;
    }
  }

  // Last resort: search Wikimedia Commons for a file clearly named after the
  // company. Not brand-specific — it works for any company whose logo file is
  // filed under its own name.
  const label: string = entity?.labels?.en?.value ?? "";
  if (label) {
    try {
      const url = `${WIKIMEDIA_COMMONS_API}?${new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrsearch: `${label} logo filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: "5",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "300",
      })}`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.ok) {
        const data = await res.json();
        const pages = Object.values(data?.query?.pages ?? {}) as any[];
        // Only accept a file whose name actually belongs to the company, so we
        // never attach an unrelated image to the brand.
        const wanted = normalizeLabel(label);
        for (const page of pages) {
          const title = String(page?.title ?? "").replace(/^File:/, "");
          if (normalizeLabel(title).startsWith(wanted)) {
            const image = page?.imageinfo?.[0];
            const source = image?.thumburl ?? image?.url;
            if (source) return source as string;
          }
        }
      }
    } catch {
      // Fall through: the brand simply could not be verified.
    }
  }

  return null;
}

/** The lead paragraph, trimmed to a single readable sentence-ish block. */
async function resolveDescription(
  title: string | null,
  wikidataDescription: string | undefined,
): Promise<string | null> {
  if (title) {
    try {
      const url = `${WIKIPEDIA_API}?${new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        prop: "extracts",
        exintro: "1",
        explaintext: "1",
        titles: title,
      })}`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.ok) {
        const data = await res.json();
        const pages = data?.query?.pages ?? {};
        const first = Object.values(pages)[0] as any;
        const extract = (first?.extract ?? "").replace(/\s+/g, " ").trim();
        if (extract) {
          if (extract.length <= 320) return extract;
          const cut = extract.slice(0, 320);
          const lastStop = Math.max(
            cut.lastIndexOf(". "),
            cut.lastIndexOf("! "),
            cut.lastIndexOf("? "),
          );
          return `${(lastStop > 80 ? cut.slice(0, lastStop + 1) : cut).trim()}…`;
        }
      }
    } catch {
      // Fall through to the Wikidata description.
    }
  }

  return wikidataDescription?.trim() || null;
}

export function slugifyBrand(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Look up a brand by name.
 *
 * Returns the resolved metadata plus the canonical name, so the admin form can
 * show exactly what will be saved before they commit.
 */
export const lookup = action({
  args: { name: v.string() },
  handler: async (_ctx, args) => {
    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("Please enter a brand name of at least 2 characters.");
    }

    let hits: SearchHit[];
    try {
      const data = await wikidataGet({
        action: "wbsearchentities",
        search: name,
        language: "en",
        type: "item",
        limit: "10",
      });
      hits = (data?.search ?? []) as SearchHit[];
    } catch (error) {
      // Log the underlying cause so a blocked/failed upstream is diagnosable
      // from the Convex logs. No user data or secrets are involved.
      console.error("[brandEnrichment] brand search failed:", error);
      throw new Error(
        "Could not reach the brand database. Please try again in a moment.",
      );
    }

    const candidate = pickCandidate(name, hits);
    if (!candidate) {
      throw new Error(
        `"${name}" could not be verified as a company. Check the spelling — it must match the company's commonly used name.`,
      );
    }

    const detail = await wikidataGet({
      action: "wbgetentities",
      ids: candidate.id,
      props: "claims|sitelinks|descriptions",
      languages: "en",
      // Without this the article link can come back empty even when an
      // English article exists, which would skip the cleanest logo source.
      sitefilter: "enwiki",
    });
    const entity = detail?.entities?.[candidate.id];
    if (!entity) {
      throw new Error(`"${name}" could not be verified as a company.`);
    }

    const title = englishArticleTitle(entity);
    const [country, logoUrl, description] = await Promise.all([
      resolveCountry(entity),
      resolveLogo(entity, title),
      resolveDescription(title, candidate.description),
    ]);

    // Never let a partially-resolved brand through: a missing field here would
    // become fake-looking placeholder content on the storefront. Throwing here
    // also guarantees the fields below are non-null for the caller.
    if (!logoUrl || !description || !country) {
      const missing: string[] = [];
      if (!logoUrl) missing.push("logo");
      if (!description) missing.push("description");
      if (!country) missing.push("country");
      throw new Error(
        `Found "${candidate.label}" but could not verify its ${missing.join(
          ", ",
        )}. The brand was not created — please check the name and retry.`,
      );
    }

    return {
      name: candidate.label!,
      slug: slugifyBrand(candidate.label!),
      description,
      logoUrl,
      country,
      source: "wikidata",
      wikidataId: candidate.id,
    };
  },
});
