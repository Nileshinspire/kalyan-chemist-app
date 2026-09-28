import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side brand enrichment.
 *
 * Admin types a brand name; this action resolves the closest real company and
 * returns its logo, description and country. Nothing is hardcoded per brand, so
 * a brand added next year resolves the same way.
 *
 * Source: Wikidata (entity identity, country of origin, official logo file)
 * and English Wikipedia (infobox logo, lead paragraph). Both are queried from
 * the Convex server, never from the browser, so no scraping happens
 * client-side and no credentials are involved.
 *
 * If the brand cannot be resolved *reliably* this throws, so the caller can
 * refuse to save an incomplete brand rather than invent metadata.
 */

const USER_AGENT =
  "KalyanChemist/1.0 (https://kalyanchemist.com; brand metadata enrichment)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIMEDIA_COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** Wikidata properties used while resolving metadata. */
const P_COUNTRY_OF_ORIGIN = "P495";
const P_COUNTRY = "P17";
const P_HEADQUARTERS = "P159";
const P_LOGO = "P154";

/**
 * Descriptions that mean "this is a trading company / manufacturer". Used to
 * reject homonyms — a name that is also a place, person, song or film must
 * never be accepted as a company.
 */
const COMPANY_HINT =
  /(\bcompan|\bcorporation|\bmanufactur|pharmaceut|\bpharma|\bdrug|\bbrand|enterprise|conglomerate|limited|\bholdings|industries|laborator|\blabs?\b|biotech|biolog|therapeut|\bhealth|consumer|\bfoods?\b|beverage|\bretail|\bsupplier|\bgroup\b|\binc\b|\bcorp\b|\bllc\b|\bplc\b|\bgmbh\b|\bco\.,|\bag\b)/i;

// ── Minimal shapes of the upstream JSON we rely on ──

type WikidataClaim = { mainsnak?: { datavalue?: { value?: unknown } } };

type WikidataEntity = {
  claims?: Record<string, WikidataClaim[]>;
  labels?: Record<string, { value?: string }>;
  sitelinks?: Record<string, { title?: string }>;
};

type WikipediaPage = {
  title?: string;
  thumbnail?: { source?: string };
  extract?: string;
  imageinfo?: { thumburl?: string; url?: string }[];
};

type SearchHit = { id: string; label?: string; description?: string };

/**
 * GET a Wikimedia API endpoint as JSON.
 *
 * Wikimedia rate-limits by IP and the Convex runtime egresses from shared
 * addresses, so a 429 is genuinely common here. Those are retried with a
 * growing backoff (honouring Retry-After) rather than shown to the admin as a
 * failure. Successful responses are memoised briefly, which also keeps a single
 * brand lookup down to one or two upstream calls.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const responseCache = new Map<string, { at: number; data: unknown }>();

async function apiGet(url: string): Promise<unknown> {
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.ok) {
        const data: unknown = await res.json();
        responseCache.set(url, { at: Date.now(), data });
        return data;
      }
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
        const waitMs =
          retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      if (res.status < 500) return null;
    } catch {
      // Network blip — fall through to the backoff below.
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function wikidataGet(params: Record<string, string>): Promise<unknown> {
  const url = `${WIKIDATA_API}?${new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  })}`;
  return apiGet(url);
}

/** The raw values of a property, ignoring claims that carry no value. */
function entityValues(entity: WikidataEntity, property: string): unknown[] {
  const claims = entity.claims?.[property] ?? [];
  return claims
    .map((claim) => claim?.mainsnak?.datavalue?.value)
    .filter((value) => value !== undefined && value !== null);
}

function entityIds(entity: WikidataEntity, property: string): string[] {
  return entityValues(entity, property)
    .map((value) => asRecord(value).id)
    .filter((id): id is string => typeof id === "string");
}

/**
 * Wikidata returns a file-name claim either as a plain string or as a
 * monolingual-text object, depending on the property. Both shapes occur in
 * practice (P154 especially), so read whichever one came back.
 */
function claimText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  const text = asRecord(value).text;
  return typeof text === "string" ? text.trim() || null : null;
}

/** Normalise a label so "Sun Pharma" and "sun-pharma ltd." can be compared. */
function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Pick the candidate most likely to be the company the admin meant. Requires a
 * company-ish description, then prefers an exact label match, then a
 * prefix match, otherwise the closest length — so "Sun Pharma" resolves to
 * "Sun Pharmaceutical" rather than to an unrelated longer entry.
 */
function pickCandidate(query: string, hits: SearchHit[]): SearchHit | null {
  const wanted = normalizeLabel(query);
  const companies = hits.filter(
    (hit) => hit.label && hit.description && COMPANY_HINT.test(hit.description),
  );
  if (companies.length === 0) return null;

  const exact = companies.find((hit) => normalizeLabel(hit.label!) === wanted);
  if (exact) return exact;

  const prefix = companies.find((hit) =>
    normalizeLabel(hit.label!).startsWith(wanted),
  );
  if (prefix) return prefix;

  return companies.reduce((best, current) => {
    const bestDistance = Math.abs(
      normalizeLabel(best.label!).length - wanted.length,
    );
    const currentDistance = Math.abs(
      normalizeLabel(current.label!).length - wanted.length,
    );
    return currentDistance < bestDistance ? current : best;
  }, companies[0]);
}

function pagesOf(data: unknown): WikipediaPage[] {
  const query = asRecord(asRecord(data).query).pages;
  return query ? (Object.values(asRecord(query)) as WikipediaPage[]) : [];
}

function entityOf(data: unknown, id: string): WikidataEntity | null {
  const entity = asRecord(asRecord(data).entities)[id];
  return entity ? (entity as WikidataEntity) : null;
}

/** Resolve a country QID to its English label. */
async function countryLabel(qid: string): Promise<string | null> {
  const data = await wikidataGet({
    action: "wbgetentities",
    ids: qid,
    props: "labels",
    languages: "en",
  });
  const label = asRecord(entityOf(data, qid)?.labels?.en).value;
  return typeof label === "string" ? label : null;
}

/**
 * Resolve the country of origin, most direct source first: country of origin →
 * country → country of the headquarters city.
 */
async function resolveCountry(entity: WikidataEntity): Promise<string | null> {
  const direct = [
    ...entityIds(entity, P_COUNTRY_OF_ORIGIN),
    ...entityIds(entity, P_COUNTRY),
  ];
  for (const qid of direct) {
    const label = await countryLabel(qid);
    if (label) return label;
  }

  for (const cityId of entityIds(entity, P_HEADQUARTERS).slice(0, 2)) {
    const city = entityOf(
      await wikidataGet({
        action: "wbgetentities",
        ids: cityId,
        props: "claims",
      }),
      cityId,
    );
    if (!city) continue;
    for (const qid of entityIds(city, P_COUNTRY).slice(0, 1)) {
      const label = await countryLabel(qid);
      if (label) return label;
    }
  }

  return null;
}

/** The English Wikipedia article title for a Wikidata item, if any. */
function englishArticleTitle(entity: WikidataEntity): string | null {
  return entity.sitelinks?.enwiki?.title ?? null;
}

/**
 * Logo, most reliable source first: the article's infobox image (already a
 * clean PNG), then the official logo file from Wikidata, then a Commons file
 * named after the company.
 */
async function resolveLogo(
  entity: WikidataEntity,
  title: string | null,
): Promise<string | null> {
  if (title) {
    const data = await apiGet(
      `${WIKIPEDIA_API}?${new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        prop: "pageimages",
        piprop: "thumbnail",
        pithumbsize: "300",
        titles: title,
      })}`,
    );
    const source = pagesOf(data)[0]?.thumbnail?.source;
    if (source) return source;
  }

  for (const value of entityValues(entity, P_LOGO)) {
    const fileName = claimText(value);
    if (fileName) {
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
        fileName,
      )}?width=300`;
    }
  }

  // Last resort: search Wikimedia Commons for a file clearly named after the
  // company. Not brand-specific — it works for any company whose logo file is
  // filed under its own name.
  const label = entity.labels?.en?.value;
  if (label) {
    const data = await apiGet(
      `${WIKIMEDIA_COMMONS_API}?${new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrsearch: `${label} logo filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: "5",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "300",
      })}`,
    );
    // Only accept a file whose name actually belongs to the company, so an
    // unrelated image can never be attached to the brand.
    const wanted = normalizeLabel(label);
    for (const page of pagesOf(data)) {
      const fileName = (page.title ?? "").replace(/^File:/, "");
      if (normalizeLabel(fileName).startsWith(wanted)) {
        const image = page.imageinfo?.[0];
        const source = image?.thumburl ?? image?.url;
        if (source) return source;
      }
    }
  }

  return null;
}

/** The lead paragraph, trimmed to a single readable block. */
async function resolveDescription(
  title: string | null,
  wikidataDescription: string | undefined,
): Promise<string | null> {
  if (title) {
    const data = await apiGet(
      `${WIKIPEDIA_API}?${new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        prop: "extracts",
        exintro: "1",
        explaintext: "1",
        titles: title,
      })}`,
    );
    const extract = (pagesOf(data)[0]?.extract ?? "").replace(/\s+/g, " ").trim();
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
      hits = (asRecord(data).search ?? []) as SearchHit[];
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

    const entity = entityOf(
      await wikidataGet({
        action: "wbgetentities",
        ids: candidate.id,
        props: "claims|sitelinks|descriptions|labels",
        languages: "en",
        // Without this the article link can come back empty even when an
        // English article exists, which would skip the cleanest logo source.
        sitefilter: "enwiki",
      }),
      candidate.id,
    );
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
    // become fake-looking placeholder content on the storefront. Throwing also
    // guarantees the returned fields are non-null for the caller.
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
