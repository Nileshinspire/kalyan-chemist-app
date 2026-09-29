import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side brand enrichment.
 *
 * The admin types only a brand name. This action resolves that name to a real
 * company/brand entity and fills in a logo, a description and a country from
 * several independent public sources, so one missing field — or one upstream
 * hiccup — never rejects a legitimate brand.
 *
 * Sources, in order of trust:
 *
 *   identity     Wikidata entity search (labels + aliases)
 *                → Wikidata class-restricted search (only companies/brands)
 *                → English Wikipedia search (article → Wikidata item)
 *                → the same Wikipedia search with generic "brand"/"company"
 *                  qualifiers, plus spelling normalisation (& ↔ and, legal
 *                  suffixes)
 *
 *   logo         article lead image
 *                → Wikidata P154 logo file
 *                → a logo file used by the article
 *                → parent / owner / manufacturer logo
 *                → Wikimedia Commons file named after the brand
 *
 *   description  Wikipedia lead paragraph
 *                → Wikidata description
 *                → a sentence composed from verified facts (name + class +
 *                  country) — never free-form invention
 *
 *   country      country of origin (P495) → country (P17)
 *                → headquarters / formation / location country (through the
 *                  administrative-territory chain)
 *                → parent organisation / owner / manufacturer country
 *                → a country named in the Wikipedia lead paragraph or the
 *                  Wikidata description
 *
 * Nothing is hardcoded per brand, so a brand added next year resolves the same
 * way. Only when the name cannot be tied to a real commercial entity does the
 * action throw — a missing *field* is searched for, not treated as an invalid
 * brand.
 */

const USER_AGENT =
  "KalyanChemist/1.0 (https://kalyanchemist.com; brand metadata enrichment)";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const WIKIMEDIA_COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** Wikidata properties used while resolving metadata. */
const P_INSTANCE_OF = "P31";
const P_COUNTRY_OF_ORIGIN = "P495";
const P_COUNTRY = "P17";
const P_HEADQUARTERS = "P159";
const P_LOCATION_OF_FORMATION = "P740";
const P_LOCATION = "P276";
const P_LOGO = "P154";
const P_OWNED_BY = "P127";
const P_PARENT_ORGANISATION = "P749";
const P_MANUFACTURER = "P176";
const P_OFFICIAL_SITE = "P856";
const P_ADMIN_TERRITORY = "P131";

/**
 * Wikidata classes that mean "this is a company or a brand". Used to narrow a
 * full-text search to commercial entities, which is how brands whose Wikidata
 * label differs from their common name (e.g. a brand owned by a group) are
 * still found by the plain name the admin typed.
 */
const COMMERCIAL_CLASSES = [
  "Q4830453", // business
  "Q783794", // company
  "Q6881511", // enterprise
  "Q891723", // public company
  "Q431289", // brand
  "Q43229", // organization
];

/**
 * Wikidata classes that mean "this is a product brand", as opposed to a
 * trading company. The admin is adding a brand, so when a name is shared by a
 * brand and an unrelated company, the brand entity is the better answer.
 */
const BRAND_CLASSES = ["Q431289", "Q167270"];

/**
 * Instance-of labels that mean "company, brand or other commercial entity".
 * Deliberately excludes vague class words ("group", "population") that match
 * non-commercial concepts sharing a name with a brand.
 */
const COMMERCIAL_CLASS_HINT =
  /(company|business|enterprise|corporation|corporate|brand|organisation|organization|manufacturer|subsidiary|conglomerate|holding company|retailer|retail chain|chain store|pharmaceutical|pharma|biotech|biotechnology|cosmetics|food|beverage|publisher|studio|bank|insurance|franchise|cooperative|\bfirm\b|startup|supermarket|brewer|winery|restaurant|privately held|public company|limited|joint venture|trademark|\blabel\b|\bdrug\b|medicine|medical|health|nutrition|supplement|personal care|household|consumer)/i;

/**
 * Wikidata/Wikipedia descriptions that mean "this is a commercial entity".
 * Kept deliberately free of words that describe non-commercial things which
 * happen to share a name with a brand, so a homonym is never accepted.
 */
const COMMERCIAL_DESCRIPTION_HINT =
  /(\bcompan|\bcorporation|\bmanufactur|pharmaceut|\bpharma|\bdrug|\bbrand|enterprise|conglomerate|limited|\bholdings|industries|laborator|\blabs?\b|biotech|biolog|therapeut|\bhealth|consumer|\bfoods?\b|beverage|\bretail|\bsupplier|\bgroup\b|\binc\b|\bcorp\b|\bllc\b|\bplc\b|\bgmbh\b|\bco\.,|\bag\b|cosmetic|skincare|skin care|personal care|toiletri|hygiene|nutraceutical|ayurved|supplement|nutrition|product line|\btrademark|subsidiary|joint venture|franchise|herbal|medicine)/i;

/**
 * Country names and adjectives. Used only as a *fallback* when no structured
 * Wikidata country claim exists, reading the country out of the Wikipedia lead
 * paragraph or the Wikidata description ("an American brand of …" → United
 * States). This is general geography, not per-brand data.
 */
const COUNTRY_TERMS: Record<string, string> = {
  "united states": "United States",
  "united states of america": "United States",
  "u s": "United States",
  usa: "United States",
  american: "United States",
  "united kingdom": "United Kingdom",
  british: "United Kingdom",
  uk: "United Kingdom",
  scottish: "United Kingdom",
  welsh: "United Kingdom",
  india: "India",
  indian: "India",
  china: "China",
  chinese: "China",
  japan: "Japan",
  japanese: "Japan",
  germany: "Germany",
  german: "Germany",
  france: "France",
  french: "France",
  switzerland: "Switzerland",
  swiss: "Switzerland",
  italy: "Italy",
  italian: "Italy",
  spain: "Spain",
  spanish: "Spain",
  portugal: "Portugal",
  portuguese: "Portugal",
  canada: "Canada",
  canadian: "Canada",
  australia: "Australia",
  australian: "Australia",
  "new zealand": "New Zealand",
  brazil: "Brazil",
  brazilian: "Brazil",
  mexico: "Mexico",
  mexican: "Mexico",
  netherlands: "Netherlands",
  dutch: "Netherlands",
  sweden: "Sweden",
  swedish: "Sweden",
  denmark: "Denmark",
  danish: "Denmark",
  norway: "Norway",
  norwegian: "Norway",
  finland: "Finland",
  finnish: "Finland",
  iceland: "Iceland",
  icelandic: "Iceland",
  ireland: "Ireland",
  irish: "Ireland",
  israel: "Israel",
  israeli: "Israel",
  singapore: "Singapore",
  singaporean: "Singapore",
  "south korea": "South Korea",
  korean: "South Korea",
  "south korean": "South Korea",
  taiwan: "Taiwan",
  taiwanese: "Taiwan",
  "hong kong": "Hong Kong",
  russia: "Russia",
  russian: "Russia",
  ukraine: "Ukraine",
  ukrainian: "Ukraine",
  poland: "Poland",
  polish: "Poland",
  austria: "Austria",
  austrian: "Austria",
  belgium: "Belgium",
  belgian: "Belgium",
  greece: "Greece",
  greek: "Greece",
  turkey: "Turkey",
  turkish: "Turkey",
  "czech republic": "Czech Republic",
  czech: "Czech Republic",
  hungary: "Hungary",
  hungarian: "Hungary",
  romania: "Romania",
  romanian: "Romania",
  bulgaria: "Bulgaria",
  bulgarian: "Bulgaria",
  croatia: "Croatia",
  croatian: "Croatia",
  serbia: "Serbia",
  serbian: "Serbia",
  slovakia: "Slovakia",
  slovak: "Slovakia",
  slovenia: "Slovenia",
  slovenian: "Slovenia",
  estonia: "Estonia",
  estonian: "Estonia",
  latvia: "Latvia",
  latvian: "Latvia",
  lithuania: "Lithuania",
  lithuanian: "Lithuania",
  luxembourg: "Luxembourg",
  malta: "Malta",
  maltese: "Malta",
  cyprus: "Cyprus",
  cypriot: "Cyprus",
  "south africa": "South Africa",
  "south african": "South Africa",
  egypt: "Egypt",
  egyptian: "Egypt",
  morocco: "Morocco",
  moroccan: "Morocco",
  tunisia: "Tunisia",
  tunisian: "Tunisia",
  algeria: "Algeria",
  algerian: "Algeria",
  libya: "Libya",
  nigeria: "Nigeria",
  nigerian: "Nigeria",
  ghana: "Ghana",
  ghanaian: "Ghana",
  kenya: "Kenya",
  kenyan: "Kenya",
  uganda: "Uganda",
  ugandan: "Uganda",
  tanzania: "Tanzania",
  tanzanian: "Tanzania",
  ethiopia: "Ethiopia",
  ethiopian: "Ethiopia",
  zimbabwe: "Zimbabwe",
  zimbabwean: "Zimbabwe",
  zambia: "Zambia",
  pakistan: "Pakistan",
  pakistani: "Pakistan",
  bangladesh: "Bangladesh",
  bangladeshi: "Bangladesh",
  "sri lanka": "Sri Lanka",
  "sri lankan": "Sri Lanka",
  nepal: "Nepal",
  nepali: "Nepal",
  nepalese: "Nepal",
  afghanistan: "Afghanistan",
  afghan: "Afghanistan",
  indonesia: "Indonesia",
  indonesian: "Indonesia",
  malaysia: "Malaysia",
  malaysian: "Malaysia",
  thailand: "Thailand",
  thai: "Thailand",
  vietnam: "Vietnam",
  vietnamese: "Vietnam",
  philippines: "Philippines",
  filipino: "Philippines",
  philippine: "Philippines",
  myanmar: "Myanmar",
  burmese: "Myanmar",
  cambodia: "Cambodia",
  cambodian: "Cambodia",
  "saudi arabia": "Saudi Arabia",
  saudi: "Saudi Arabia",
  "united arab emirates": "United Arab Emirates",
  emirati: "United Arab Emirates",
  qatar: "Qatar",
  qatari: "Qatar",
  kuwait: "Kuwait",
  kuwaiti: "Kuwait",
  bahrain: "Bahrain",
  oman: "Oman",
  jordan: "Jordan",
  jordanian: "Jordan",
  lebanon: "Lebanon",
  lebanese: "Lebanon",
  syria: "Syria",
  syrian: "Syria",
  iraq: "Iraq",
  iraqi: "Iraq",
  iran: "Iran",
  iranian: "Iran",
  argentina: "Argentina",
  argentine: "Argentina",
  argentinian: "Argentina",
  chile: "Chile",
  chilean: "Chile",
  colombia: "Colombia",
  colombian: "Colombia",
  peru: "Peru",
  peruvian: "Peru",
  venezuela: "Venezuela",
  venezuelan: "Venezuela",
  ecuador: "Ecuador",
  ecuadorian: "Ecuador",
  uruguay: "Uruguay",
  bolivia: "Bolivia",
  paraguay: "Paraguay",
  "costa rica": "Costa Rica",
  panama: "Panama",
  guatemala: "Guatemala",
  cuba: "Cuba",
  cuban: "Cuba",
  jamaica: "Jamaica",
  jamaican: "Jamaica",
  haiti: "Haiti",
  "dominican republic": "Dominican Republic",
  kazakhstan: "Kazakhstan",
  uzbekistan: "Uzbekistan",
  azerbaijan: "Azerbaijan",
  armenia: "Armenia",
  mongolia: "Mongolia",
};

/** Terms indexed by their first word so long/multi-word matches win first. */
const TERM_INDEX = new Map<string, { tokens: string[]; country: string }[]>();
for (const [term, country] of Object.entries(COUNTRY_TERMS)) {
  const tokens = normalizeLabel(term).split(" ").filter(Boolean);
  if (tokens.length === 0) continue;
  const list = TERM_INDEX.get(tokens[0]) ?? [];
  list.push({ tokens, country });
  TERM_INDEX.set(tokens[0], list);
}
for (const list of TERM_INDEX.values()) {
  list.sort((a, b) => b.tokens.length - a.tokens.length);
}

/** Words that are not part of a brand name when comparing file names. */
const FILE_NOISE = /^(file|image|logo|logotype|logomark|wordmark|brandmark|png|jpe?g|gif|svg|webp|tiff|bmp|px|\d+px)$/;

// ── Minimal shapes of the upstream JSON we rely on ──

type WikidataClaim = { mainsnak?: { datavalue?: { value?: unknown } } };

type WikidataEntity = {
  claims?: Record<string, WikidataClaim[]>;
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  aliases?: Record<string, { value?: string }[]>;
  sitelinks?: Record<string, { title?: string }>;
};

type WikipediaPage = {
  title?: string;
  thumbnail?: { source?: string };
  extract?: string;
  images?: { title?: string }[];
  pageprops?: { wikibase_item?: string };
  imageinfo?: { thumburl?: string; url?: string }[];
};

type SearchHit = { id?: string; label?: string; description?: string };

/** A search result awaiting evaluation. */
type Candidate = {
  id: string;
  source: "wikidata" | "wikidata-class" | "wikipedia";
  rank: number;
};

/** Per-call state: entities and labels loaded so far. */
type ResolutionContext = {
  entities: Map<string, WikidataEntity>;
  labels: Map<string, string | null>;
};

/**
 * GET a Wikimedia API endpoint as JSON.
 *
 * Wikimedia rate-limits by IP and the Convex runtime egresses from shared
 * addresses, so a 429 is genuinely common here. Those are retried with a
 * growing backoff (honouring Retry-After) rather than shown to the admin as a
 * failure. Successful responses are memoised briefly, which also keeps a single
 * brand lookup down to a handful of upstream calls.
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

function wikipediaGet(params: Record<string, string>): Promise<unknown> {
  const url = `${WIKIPEDIA_API}?${new URLSearchParams({
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

/** Normalise text so "Sun Pharma" and "sun-pharma ltd." can be compared. */
function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokensOf(value: string): string[] {
  return normalizeLabel(value).split(" ").filter(Boolean);
}

function pagesOf(data: unknown): WikipediaPage[] {
  const query = asRecord(asRecord(data).query).pages;
  return query ? (Object.values(asRecord(query)) as WikipediaPage[]) : [];
}

function entityOf(data: unknown, id: string): WikidataEntity | null {
  const entity = asRecord(asRecord(data).entities)[id];
  return entity ? (entity as WikidataEntity) : null;
}

/** The English Wikipedia article title for a Wikidata item, if any. */
function englishArticleTitle(entity: WikidataEntity): string | null {
  return entity.sitelinks?.enwiki?.title ?? null;
}

/** Strip tracking parameters Wikimedia appends to thumbnail URLs. */
function cleanThumbnailUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.split("?")[0].trim();
  return trimmed || null;
}

/** The stable, always-resolvable URL for a Commons file at a given width. */
function commonsFilePath(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
    fileName,
  )}?width=300`;
}

// ── Entity loading ──

/** Load entities by id in batches, reusing anything already fetched. */
async function loadEntities(
  ctx: ResolutionContext,
  ids: string[],
): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => !ctx.entities.has(id));
  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40);
    const data = await wikidataGet({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "claims|sitelinks|descriptions|labels|aliases",
      languages: "en",
      // Every sitelink is requested (not just enwiki) so the number of
      // language editions can be used as a notability signal when two
      // entities match the typed name equally well.
    });
    const entities = asRecord(asRecord(data).entities);
    for (const id of batch) {
      const raw = entities[id];
      ctx.entities.set(
        id,
        raw && typeof raw === "object" ? (raw as WikidataEntity) : {},
      );
    }
  }
}

async function entityById(
  ctx: ResolutionContext,
  id: string,
): Promise<WikidataEntity | null> {
  await loadEntities(ctx, [id]);
  const entity = ctx.entities.get(id);
  return entity && Object.keys(entity).length > 0 ? entity : null;
}

/**
 * Load English labels for QIDs in batches, reusing anything already fetched.
 * Labels are resolved constantly (classes, countries), so batching keeps a
 * lookup well inside Wikimedia's rate limit.
 */
async function loadLabels(
  ctx: ResolutionContext,
  ids: string[],
): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => !ctx.labels.has(id));
  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40);
    const data = await wikidataGet({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels",
      languages: "en",
    });
    for (const id of batch) {
      const label = asRecord(entityOf(data, id)?.labels?.en).value;
      ctx.labels.set(id, typeof label === "string" ? label : null);
    }
  }
}

/** Resolve a QID to its English label (cached for the lifetime of the call). */
async function entityLabel(
  ctx: ResolutionContext,
  qid: string,
): Promise<string | null> {
  await loadLabels(ctx, [qid]);
  return ctx.labels.get(qid) ?? null;
}

/** Labels of an entity's instance-of classes, used to recognise a company. */
async function classLabels(
  ctx: ResolutionContext,
  entity: WikidataEntity,
): Promise<string[]> {
  const ids = entityIds(entity, P_INSTANCE_OF).slice(0, 8);
  await loadLabels(ctx, ids);
  return ids
    .map((id) => ctx.labels.get(id))
    .filter((label): label is string => typeof label === "string");
}

// ── Identity helpers ──

/**
 * Is this entity a company/brand rather than a place, person, song or film?
 * Accepts a commercial instance-of class (by id first — that is exact — then by
 * label) or a commercial description, so it still works for entities whose
 * Wikidata classes are incomplete.
 */
async function looksCommercial(
  ctx: ResolutionContext,
  entity: WikidataEntity,
): Promise<boolean> {
  const classes = entityIds(entity, P_INSTANCE_OF);
  if (classes.some((id) => COMMERCIAL_CLASSES.includes(id))) return true;

  const description = entity.descriptions?.en?.value ?? "";
  if (description && COMMERCIAL_DESCRIPTION_HINT.test(description)) return true;

  if (classes.length > 0) {
    const labels = await classLabels(ctx, entity);
    if (labels.some((label) => COMMERCIAL_CLASS_HINT.test(label))) return true;
  }
  return false;
}

/** Does Wikidata itself describe this entity as a product brand? */
function isBrandEntity(entity: WikidataEntity): boolean {
  return entityIds(entity, P_INSTANCE_OF).some((id) =>
    BRAND_CLASSES.includes(id),
  );
}

/** The first instance-of label that reads as a commercial entity. */
async function commercialClassLabel(
  ctx: ResolutionContext,
  entity: WikidataEntity,
): Promise<string | null> {
  const labels = await classLabels(ctx, entity);
  return labels.find((label) => COMMERCIAL_CLASS_HINT.test(label)) ?? null;
}

/** Distinctive names for an entity, best first (used for logo/name matching). */
function brandNames(entity: WikidataEntity): string[] {
  const names = [
    entity.labels?.en?.value ?? "",
    ...(entity.aliases?.en ?? []).map((alias) => alias.value ?? ""),
    entity.sitelinks?.enwiki?.title ?? "",
  ];
  return names.map((name) => name.trim()).filter(Boolean);
}

/** Leading articles are not part of a brand's identity ("The X Company"). */
const ARTICLE_WORDS = new Set(["the", "a", "an"]);

function withoutArticles(tokens: string[]): string[] {
  let start = 0;
  while (start < tokens.length - 1 && ARTICLE_WORDS.has(tokens[start])) {
    start += 1;
  }
  return tokens.slice(start);
}

/**
 * How well the entity's names match what the admin typed. 0 means "no
 * meaningful match" and the candidate is discarded, so an unrelated search hit
 * can never be saved as this brand.
 */
function nameMatchScore(query: string, entity: WikidataEntity): number {
  const wanted = withoutArticles(tokensOf(query));
  if (wanted.length === 0) return 0;

  const label = entity.labels?.en?.value ?? "";
  const title = entity.sitelinks?.enwiki?.title ?? "";
  const aliases = (entity.aliases?.en ?? []).map((alias) => alias.value ?? "");

  const exact = (name: string) =>
    tokensOf(name).join(" ") === wanted.join(" ");
  const contains = (name: string) => {
    const tokens = tokensOf(name);
    for (let i = 0; i + wanted.length <= tokens.length; i += 1) {
      if (wanted.every((token, j) => tokens[i + j] === token)) return true;
    }
    return false;
  };
  const startsWith = (name: string) => {
    const tokens = withoutArticles(tokensOf(name));
    return (
      tokens.length >= wanted.length &&
      wanted.every((token, j) => tokens[j] === token)
    );
  };

  // "Always (Whisper) (brand)" is the article for a brand that is sold as
  // Whisper in some markets, so a match inside the title's parentheses is a
  // strong alias signal — often stronger than a coincidental prefix.
  const titleAlias = () => {
    const groups = title.match(/\(([^)]*)\)/g) ?? [];
    return groups.some((group) => contains(group.replace(/[()]/g, " ")));
  };

  if ([label, ...aliases].some((name) => name && exact(name))) return 5;
  if (title && exact(title)) return 4.8;
  if (title && titleAlias()) return 4.4;
  if (label && startsWith(label)) return 4;
  if (title && startsWith(title)) return 3.6;
  if (label && contains(label)) return 3.2;
  if (aliases.some((name) => name && contains(name))) return 3;
  if (title && contains(title)) return 2.8;
  return 0;
}

/**
 * How widely the entity is covered across Wikipedia language editions. Used to
 * choose between two entities that match the typed name equally well — the
 * better-known one is almost always the brand the admin means.
 */
function sitelinkCount(entity: WikidataEntity): number {
  return Object.keys(entity.sitelinks ?? {}).length;
}

/** Prefer the entity with the most usable metadata when scores tie. */
function metadataRichness(entity: WikidataEntity): number {
  const signals = [
    englishArticleTitle(entity) ? 1 : 0,
    entityValues(entity, P_LOGO).length > 0 ? 1 : 0,
    entityValues(entity, P_COUNTRY_OF_ORIGIN).length > 0 ? 1 : 0,
    entityValues(entity, P_COUNTRY).length > 0 ? 1 : 0,
    entityValues(entity, P_HEADQUARTERS).length > 0 ? 1 : 0,
    entityValues(entity, P_OWNED_BY).length > 0 ? 1 : 0,
    entityValues(entity, P_PARENT_ORGANISATION).length > 0 ? 1 : 0,
    entityValues(entity, P_MANUFACTURER).length > 0 ? 1 : 0,
  ];
  return signals.reduce((total, value) => total + value, 0);
}

// ── Search ──

/** Wikidata entity search matches labels and aliases — the most precise start. */
async function searchWikidataEntity(query: string): Promise<Candidate[]> {
  const data = await wikidataGet({
    action: "wbsearchentities",
    search: query,
    language: "en",
    type: "item",
    limit: "10",
  });
  const hits = (asRecord(data).search ?? []) as SearchHit[];
  return hits
    .map((hit, rank) => ({ id: hit.id ?? "", rank }))
    .filter((hit) => hit.id)
    .map((hit) => ({
      id: hit.id,
      rank: hit.rank,
      source: "wikidata" as const,
    }));
}

/**
 * Full-text search restricted to the given classes. This is how brands whose
 * own label differs from the name on the shop shelf are still found, and how
 * entities that the label/alias search misses (because it only looks at names)
 * are picked up. Brand classes and company classes are queried separately
 * because a single combined statement does not reliably return both sets.
 */
async function searchWikidataClasses(
  query: string,
  classIds: string[],
): Promise<Candidate[]> {
  const statement = `${P_INSTANCE_OF}=${classIds.join("|")}`;
  const data = await wikidataGet({
    action: "query",
    list: "search",
    srsearch: `${query} haswbstatement:${statement}`,
    srnamespace: "0",
    srlimit: "10",
  });
  const hits = asRecord(asRecord(data).query).search;
  if (!Array.isArray(hits)) return [];
  return (hits as { title?: string }[])
    .map((hit, rank) => ({ id: hit.title ?? "", rank }))
    .filter((hit) => /^Q\d+$/.test(hit.id))
    .map((hit) => ({
      id: hit.id,
      rank: hit.rank,
      source: "wikidata-class" as const,
    }));
}

/** English Wikipedia search — resolves articles back to their Wikidata item. */
async function searchWikipedia(query: string): Promise<Candidate[]> {
  const data = await wikipediaGet({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "8",
  });
  const hits = asRecord(asRecord(data).query).search;
  if (!Array.isArray(hits)) return [];
  const titles = (hits as { title?: string }[])
    .map((hit) => hit.title ?? "")
    .filter(Boolean);
  if (titles.length === 0) return [];

  const props = await wikipediaGet({
    action: "query",
    prop: "pageprops",
    ppprop: "wikibase_item",
    titles: titles.join("|"),
  });
  const byTitle = new Map<string, string>();
  for (const page of pagesOf(props)) {
    const qid = page.pageprops?.wikibase_item;
    if (page.title && qid) byTitle.set(page.title, qid);
  }

  return titles
    .map((title, rank) => ({ id: byTitle.get(title) ?? "", rank }))
    .filter((hit) => /^Q\d+$/.test(hit.id))
    .map((hit) => ({
      id: hit.id,
      rank: hit.rank,
      source: "wikipedia" as const,
    }));
}

/** Spelling variants worth retrying before giving up on a name. */
function nameVariants(name: string): string[] {
  const variants = new Set<string>();
  const trimmed = name.trim();
  if (trimmed.includes("&")) variants.add(trimmed.replace(/&/g, " and "));
  if (/ and /i.test(trimmed)) variants.add(trimmed.replace(/ and /gi, " & "));
  const stripped = trimmed.replace(
    /[\s,]+(limited|ltd|inc|incorporated|corp|corporation|plc|llc|pvt|private|gmbh|s\.?a\.?|ag|nv|bv)\.?$/i,
    "",
  );
  if (stripped && stripped !== trimmed && stripped.length >= 2) {
    variants.add(stripped);
  }
  variants.delete(trimmed);
  return [...variants];
}

/**
 * Collect candidate entities from every source, cheapest and most precise
 * first, escalating only while nothing commercial has been found. Extra
 * searches cost upstream calls (and rate-limit budget), so a brand that
 * resolves immediately stays a one- or two-request lookup.
 */
async function gatherCandidates(
  name: string,
  ctx: ResolutionContext,
): Promise<Candidate[]> {
  const queries = [name, ...nameVariants(name)];
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const add = (found: Candidate[]) => {
    for (const candidate of found) {
      if (seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      candidates.push(candidate);
    }
  };

  // Escalate only while nothing that both matches the name *and* reads as a
  // commercial entity has turned up — a homonym (a mountain, a song, an
  // album) must not stop the search for the real company behind the name.
  const accepted = async () => {
    if (candidates.length === 0) return false;
    await loadEntities(
      ctx,
      candidates.map((candidate) => candidate.id),
    );
    for (const candidate of candidates) {
      const entity = ctx.entities.get(candidate.id);
      if (!entity || nameMatchScore(name, entity) === 0) continue;
      if (await looksCommercial(ctx, entity)) return true;
    }
    return false;
  };

  for (const query of queries) {
    add(await searchWikidataEntity(query));
    add(await searchWikidataClasses(query, BRAND_CLASSES));
    add(await searchWikidataClasses(query, COMMERCIAL_CLASSES));
    if (await accepted()) return candidates;

    add(await searchWikipedia(query));
    if (await accepted()) return candidates;
  }

  // Nothing matched on the name itself. Fall back to a generic qualifier, in
  // the same way a person would search for "X brand" or "X company".
  for (const query of queries) {
    for (const qualifier of ["brand", "company"]) {
      add(await searchWikipedia(`${query} ${qualifier}`));
    }
  }

  return candidates;
}

/**
 * Pick the entity that best matches the typed name among the commercial
 * candidates, or null when the name cannot be tied to a real company/brand.
 */
async function pickCandidate(
  name: string,
  candidates: Candidate[],
  ctx: ResolutionContext,
): Promise<{ id: string; source: Candidate["source"] } | null> {
  if (candidates.length === 0) return null;
  await loadEntities(
    ctx,
    candidates.map((candidate) => candidate.id),
  );

  type Scored = {
    id: string;
    source: Candidate["source"];
    score: number;
    brand: boolean;
    rank: number;
    coverage: number;
    richness: number;
    labelLength: number;
  };
  const scored: Scored[] = [];

  for (const candidate of candidates) {
    const entity = ctx.entities.get(candidate.id);
    if (!entity) continue;
    const score = nameMatchScore(name, entity);
    if (score === 0) continue;
    if (!(await looksCommercial(ctx, entity))) continue;

    scored.push({
      id: candidate.id,
      source: candidate.source,
      score,
      brand: isBrandEntity(entity),
      rank: candidate.rank,
      coverage: sitelinkCount(entity),
      richness: metadataRichness(entity),
      labelLength: tokensOf(entity.labels?.en?.value ?? "").length,
    });
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 1e-9) return b.score - a.score;
    // A product brand is what the admin is adding, so it wins over a company
    // that merely carries the same name.
    if (a.brand !== b.brand) return a.brand ? -1 : 1;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    if (b.richness !== a.richness) return b.richness - a.richness;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.labelLength - b.labelLength;
  });

  return { id: scored[0].id, source: scored[0].source };
}

// ── Country resolution ──

/** The country a place belongs to: its own country, else walk up the chain. */
async function countryOfPlace(
  ctx: ResolutionContext,
  placeId: string,
  depth: number,
): Promise<string | null> {
  if (depth > 5) return null;
  const entity = await entityById(ctx, placeId);
  if (!entity) return null;

  for (const qid of entityIds(entity, P_COUNTRY).slice(0, 1)) {
    const label = await entityLabel(ctx, qid);
    if (label) return label;
  }
  for (const parent of entityIds(entity, P_ADMIN_TERRITORY).slice(0, 1)) {
    const found = await countryOfPlace(ctx, parent, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Related entities whose country can stand in for a brand's country. */
function relatedEntityIds(entity: WikidataEntity): string[] {
  return [
    ...entityIds(entity, P_OWNED_BY),
    ...entityIds(entity, P_PARENT_ORGANISATION),
    ...entityIds(entity, P_MANUFACTURER),
  ].slice(0, 3);
}

/**
 * Structured country lookup: country of origin → country → headquarters /
 * formation / location country → the same chain on the parent organisation,
 * owner or manufacturer. Returns null (never a guess) when nothing is found.
 */
async function countryOfEntity(
  ctx: ResolutionContext,
  entity: WikidataEntity,
  depth: number,
): Promise<string | null> {
  if (depth > 3) return null;

  for (const qid of [
    ...entityIds(entity, P_COUNTRY_OF_ORIGIN),
    ...entityIds(entity, P_COUNTRY),
  ].slice(0, 2)) {
    const label = await entityLabel(ctx, qid);
    if (label) return label;
  }

  for (const placeId of [
    ...entityIds(entity, P_HEADQUARTERS),
    ...entityIds(entity, P_LOCATION_OF_FORMATION),
    ...entityIds(entity, P_LOCATION),
  ].slice(0, 3)) {
    const found = await countryOfPlace(ctx, placeId, 0);
    if (found) return found;
  }

  for (const relatedId of relatedEntityIds(entity)) {
    const related = await entityById(ctx, relatedId);
    if (!related) continue;
    const found = await countryOfEntity(ctx, related, depth + 1);
    if (found) return found;
  }

  return null;
}

/**
 * Read a country out of free text ("an American brand of …"). Only used when
 * no structured claim exists. Returns the first country mentioned, which in a
 * lead paragraph is the one that describes the brand itself.
 */
function inferCountryFromText(text: string): string | null {
  const tokens = tokensOf(text);
  for (let i = 0; i < tokens.length; i += 1) {
    const terms = TERM_INDEX.get(tokens[i]);
    if (!terms) continue;
    for (const term of terms) {
      if (term.tokens.every((token, j) => tokens[i + j] === token)) {
        return term.country;
      }
    }
  }
  return null;
}

/** Every text source that may name the country, used for the inference above. */
async function countryCorpus(
  ctx: ResolutionContext,
  entity: WikidataEntity,
  articleText: string | null,
): Promise<string> {
  const parts = [
    articleText ?? "",
    entity.descriptions?.en?.value ?? "",
    englishArticleTitle(entity) ?? "",
    entity.labels?.en?.value ?? "",
    ...(await classLabels(ctx, entity)),
  ];

  for (const relatedId of relatedEntityIds(entity)) {
    const related = await entityById(ctx, relatedId);
    if (!related) continue;
    parts.push(related.descriptions?.en?.value ?? "");
    parts.push(related.labels?.en?.value ?? "");
  }

  return parts.join(" \n ");
}

// ── Description resolution ──

/** The lead paragraph, trimmed to a single readable block. */
function trimExtract(extract: string | undefined): string | null {
  const text = (extract ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= 320) return text;
  const cut = text.slice(0, 320);
  const lastStop = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
  );
  return `${(lastStop > 80 ? cut.slice(0, lastStop + 1) : cut).trim()}…`;
}

/**
 * A factual last-resort description assembled only from values that were
 * themselves resolved from the sources above — no invented copy.
 */
function composeDescription(
  name: string,
  country: string | null,
  classLabel: string | null,
): string | null {
  if (!classLabel) return null;
  const kind = classLabel.toLowerCase();
  return country
    ? `${name} is a ${kind} based in ${country}.`
    : `${name} is a ${kind}.`;
}

// ── Logo resolution ──

/** The article's lead image, if it has one. */
async function articleThumbnail(title: string): Promise<string | null> {
  const data = await wikipediaGet({
    action: "query",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "300",
    titles: title,
  });
  return cleanThumbnailUrl(pagesOf(data)[0]?.thumbnail?.source);
}

/** The article's plain-text lead paragraph. */
async function articleExtract(title: string): Promise<string | null> {
  const data = await wikipediaGet({
    action: "query",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    titles: title,
  });
  return trimExtract(pagesOf(data)[0]?.extract);
}

/** The official logo file declared on the entity itself. */
function logoFileOf(entity: WikidataEntity): string | null {
  for (const value of entityValues(entity, P_LOGO)) {
    const fileName = claimText(value);
    if (fileName) return commonsFilePath(fileName);
  }
  return null;
}

/**
 * Turn a file name into a directly usable image URL.
 *
 * Files used by an article are not always hosted on Commons (many logos are
 * local to Wikipedia), so the URL has to come from the Wikipedia API rather
 * than the Commons `Special:FilePath` shortcut.
 */
async function wikipediaImageUrl(
  fileName: string,
  width = 300,
): Promise<string | null> {
  const data = await wikipediaGet({
    action: "query",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: String(width),
    titles: `File:${fileName}`,
  });
  const info = pagesOf(data)[0]?.imageinfo?.[0];
  return cleanThumbnailUrl(info?.thumburl ?? info?.url);
}

/**
 * A logo file used *by the article*. Many brand articles keep their logo as a
 * non-lead image, which is more useful than a lead photo of a building.
 */
async function articleLogoFile(
  title: string,
  wanted: string[],
): Promise<string | null> {
  const data = await wikipediaGet({
    action: "query",
    prop: "images",
    imlimit: "100",
    titles: title,
  });
  const files = (pagesOf(data)[0]?.images ?? [])
    .map((image) => (image.title ?? "").replace(/^File:/, "").trim())
    .filter((fileName) => /\b(logo|logotype|wordmark|brandmark)\b/i.test(fileName));
  if (files.length === 0) return null;

  // The file has to be named after the brand: articles also carry generic
  // navigational icons, and one of those must never become a brand's logo.
  const wantedTokens = wanted.map(tokensOf).filter((tokens) => tokens.length > 0);
  const match = files.find((fileName) => {
    const tokens = tokensOf(fileName);
    return wantedTokens.some((names) =>
      names.every((token) => tokens.includes(token)),
    );
  });
  return match ? await wikipediaImageUrl(match) : null;
}

/** How long a request to a brand's own website may take. */
const SITE_TIMEOUT_MS = 6000;

/** fetch with a hard timeout and a browser-like identifier. */
async function fetchWithTimeout(
  url: string,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a possibly relative href against the page it was found on. */
function absoluteUrl(href: string, base: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = /^(https?:\/\/[^/]+)/i.exec(base)?.[1];
  if (!origin) return null;
  if (trimmed.startsWith("//")) return `${origin.split(":")[0]}:${trimmed}`;
  return trimmed.startsWith("/") ? `${origin}${trimmed}` : `${origin}/${trimmed}`;
}

/** Confirm a URL really serves an image before it is stored as a logo. */
async function isReachableImage(url: string): Promise<boolean> {
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return false;
  return (res.headers.get("content-type") ?? "").startsWith("image/");
}

/**
 * The brand mark its own website declares.
 *
 * This is the last stop in the logo chain, for brands that have no Wikimedia
 * logo file at all. The icon is read from the site the entity itself points to
 * and is only returned once it has been confirmed to serve an image, so a
 * broken or blocked site simply yields nothing rather than a dead URL.
 */
async function officialSiteIcon(site: string): Promise<string | null> {
  const res = await fetchWithTimeout(site);
  const html = res && res.ok ? (await res.text()).slice(0, 200_000) : "";
  const base = res?.url || site;

  const links: { rel: string; url: string }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
    if (!/icon/i.test(rel)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const url = href ? absoluteUrl(href, base) : null;
    if (url) links.push({ rel, url });
  }

  const favicon = absoluteUrl("/favicon.ico", base);
  const ordered = [
    ...links.filter((link) => /apple-touch-icon/i.test(link.rel)),
    ...links.filter((link) => /\.(png|svg)(\?|$)/i.test(link.url)),
    ...links,
    ...(favicon ? [favicon] : []),
  ];

  const tried = new Set<string>();
  for (const candidate of ordered.map((entry) => (typeof entry === "string" ? entry : entry.url))) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    if (await isReachableImage(candidate)) return candidate;
  }
  return null;
}

/** Search Wikimedia Commons for a logo file named after the brand. */
async function searchCommonsLogo(names: string[]): Promise<string | null> {
  let best: { file: string; score: number } | null = null;

  for (const name of names) {
    const clean = name.replace(/\(.*?\)/g, " ").trim();
    if (clean.length < 2) continue;
    const data = await apiGet(
      `${WIKIMEDIA_COMMONS_API}?${new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        generator: "search",
        gsrsearch: `${clean} logo filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: "10",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "300",
      })}`,
    );
    const query = asRecord(asRecord(data).query).pages;
    if (!query) continue;

    const wanted = tokensOf(clean);
    if (wanted.length === 0) continue;

    for (const page of Object.values(asRecord(query)) as WikipediaPage[]) {
      const fileName = (page.title ?? "").replace(/^File:/, "").trim();
      const tokens = tokensOf(fileName);
      if (!tokens.some((token) => /^(logo|logotype|wordmark|brandmark)$/.test(token))) {
        continue;
      }
      const meaningful = tokens.filter((token) => !FILE_NOISE.test(token));
      const at = meaningful.findIndex((token) => token === wanted[0]);
      if (at === -1) continue;
      const contiguous = wanted.every(
        (token, j) => meaningful[at + j] === token,
      );
      if (!contiguous) continue;

      // "Always logo.png" beats "800px-Always Greener Logo.png": after the
      // noise words are dropped, a name that starts with the brand wins.
      const score = (at === 0 ? 2 : 1) * 100 - meaningful.length;
      if (!best || score > best.score) best = { file: fileName, score };
    }
  }

  return best ? commonsFilePath(best.file) : null;
}

/**
 * Logo, most reliable source first: the logo file declared on Wikidata, the
 * article's lead image, a logo file used by the article, the parent/owner
 * company's logo, then a Commons file named after the brand.
 */
async function resolveLogo(
  ctx: ResolutionContext,
  entityId: string,
  entity: WikidataEntity,
  enteredName: string,
  depth: number,
): Promise<string | null> {
  const title = englishArticleTitle(entity);

  // The declared logo property is the cleanest source — a lead image can be a
  // photo of a shop or a headquarters rather than the brand mark.
  const declared = logoFileOf(entity);
  if (declared) return declared;

  if (title) {
    const fromArticle = await articleLogoFile(title, [
      enteredName,
      ...brandNames(entity),
    ]);
    if (fromArticle) return fromArticle;
  }

  // The lead image is a decent last resort, but it is often a photo of a shop
  // or a headquarters rather than the brand mark, so a named logo wins first.
  if (title) {
    const thumbnail = await articleThumbnail(title);
    if (thumbnail) return thumbnail;
  }

  if (depth < 2) {
    for (const relatedId of relatedEntityIds(entity)) {
      const related = await entityById(ctx, relatedId);
      if (!related) continue;
      // A parent company's *declared* logo is a far better fit than whatever
      // photo happens to lead its article.
      const relatedLogo =
        logoFileOf(related) ??
        (await resolveLogo(ctx, relatedId, related, enteredName, depth + 1));
      if (relatedLogo) return relatedLogo;
    }
  }

  const commons = await searchCommonsLogo([
    entity.labels?.en?.value ?? "",
    enteredName,
    englishArticleTitle(entity) ?? "",
  ]);
  if (commons) return commons;

  // Last stop: the brand mark the entity's own website declares.
  for (const site of entityValues(entity, P_OFFICIAL_SITE).slice(0, 2)) {
    const url = typeof site === "string" ? site.trim() : "";
    if (!url) continue;
    const icon = await officialSiteIcon(url);
    if (icon) return icon;
  }

  return null;
}

// ── Naming ──

/**
 * The name to store. The admin's spelling wins when the resolved entity
 * genuinely carries it (so a brand stays "Whisper" even though its Wikidata
 * item is titled "Always"), otherwise the canonical label is used.
 */
function preferredName(entered: string, entity: WikidataEntity): string {
  const canonical = entity.labels?.en?.value?.trim() ?? entered;
  const names = brandNames(entity);
  const wanted = tokensOf(entered).join(" ");

  const exact = names.find((name) => tokensOf(name).join(" ") === wanted);
  if (exact) return exact;
  if (names.some((name) => tokensOf(name).includes(wanted))) return entered;
  return canonical || entered;
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
 * show exactly what will be saved before they commit. Throws only when the
 * name cannot be tied to a real company/brand — a metadata field that is
 * missing from one source is looked up in the next one instead.
 */
export const lookup = action({
  args: { name: v.string() },
  handler: async (_ctx, args) => {
    const entered = args.name.trim();
    if (entered.length < 2) {
      throw new Error("Please enter a brand name of at least 2 characters.");
    }

    const ctx: ResolutionContext = {
      entities: new Map(),
      labels: new Map(),
    };

    let candidates: Candidate[];
    try {
      candidates = await gatherCandidates(entered, ctx);
    } catch (error) {
      // Log the underlying cause so a blocked/failed upstream is diagnosable
      // from the Convex logs. No user data or secrets are involved.
      console.error("[brandEnrichment] brand search failed:", error);
      throw new Error(
        "Could not reach the brand database. Please try again in a moment.",
      );
    }

    const match = await pickCandidate(entered, candidates, ctx);
    if (!match) {
      throw new Error(
        `"${entered}" could not be verified as a real brand or company. Check the spelling — it has to match the brand's commonly used name.`,
      );
    }

    const candidateId = match.id;
    const entity = await entityById(ctx, candidateId);
    if (!entity) {
      throw new Error(
        `"${entered}" could not be verified as a real brand or company.`,
      );
    }

    const title = englishArticleTitle(entity);
    const extract = title ? await articleExtract(title) : null;

    // ── country: structured claims first, then the words around the brand ──
    let country = await countryOfEntity(ctx, entity, 0);
    if (!country) {
      country = inferCountryFromText(
        await countryCorpus(ctx, entity, extract),
      );
    }

    // ── description: Wikipedia lead paragraph, Wikidata, then composed ──
    const name = preferredName(entered, entity);
    const wikidataDescription = (entity.descriptions?.en?.value ?? "").trim();
    const finalDescription =
      extract ||
      wikidataDescription ||
      composeDescription(name, country, await commercialClassLabel(ctx, entity));

    const logoUrl = await resolveLogo(ctx, candidateId, entity, entered, 0);

    if (!logoUrl || !finalDescription || !country) {
      // Every source above has been tried; only genuinely undocumented
      // entities reach this point. Report precisely what is missing, so a
      // missing source is never confused with an invalid brand, and so no
      // placeholder metadata is ever saved.
      const missing: string[] = [];
      if (!logoUrl) missing.push("logo");
      if (!finalDescription) missing.push("description");
      if (!country) missing.push("country");
      console.error(
        "[brandEnrichment] verified",
        candidateId,
        "but missing:",
        missing.join(", "),
      );
      throw new Error(
        `Found "${name}" but no reliable source has its ${missing.join(
          " or ",
        )} yet. The brand was not created — try again in a moment.`,
      );
    }

    return {
      name,
      slug: slugifyBrand(name),
      description: finalDescription,
      logoUrl,
      country,
      source: match.source,
      wikidataId: candidateId,
    };
  },
});
