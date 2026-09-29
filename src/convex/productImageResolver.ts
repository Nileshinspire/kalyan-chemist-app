/**
 * Product image resolution — finds the REAL commercial packshot for an exact
 * product and stores it in Convex storage.
 *
 * Rules this module deliberately enforces:
 *
 * - Search with the FULL product identity (name + brand + manufacturer +
 *   strength + form + pack size), never just the generic composition.
 * - Accept an image only when the candidate product's own record proves it is
 *   the same product: every meaningful word of the entered name must appear as
 *   a whole word, and a dose strength (mg/mcg/IU, or a bare tablet number like
 *   "Dolo 650") must match exactly. Near-misses — Dolo 500, Dolo Cold,
 *   "Dolopar 650", a generic paracetamol pack — are rejected rather than
 *   accepted as "close enough".
 * - Never invent an image. There is no placeholder, generic icon or generated
 *   graphic anywhere in this path: when nothing can be verified the caller gets
 *   an explicit failure so the admin can retry or fix the name.
 * - Never store a third-party URL as the product image. Verified bytes are
 *   downloaded and written to Convex storage, so the customer-facing image
 *   cannot rot when the source moves.
 *
 * Source order: a licensed Indian pharmacy catalogue (PharmEasy), whose product
 * records carry the pack name, manufacturer, pack form and per-face packshots.
 * Anything that is not a real, verified packshot is treated as "no image".
 */
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const USER_AGENT =
  "KalyanChemist/1.0 (https://kalyanchemist.com; product image retrieval)";

/** Catalogue with per-product records: name, manufacturer, pack form, images. */
const PHARMEASY_SEARCH = "https://pharmeasy.in/search/all?name=";

const FETCH_TIMEOUT_MS = 12_000;
/** Card-sized render of the stored asset — crisp, small, and CDN-supported. */
const IMAGE_DIM = "600x0";
const MIN_IMAGE_BYTES = 2_000;
const MAX_IMAGE_BYTES = 4_000_000;
const MAX_SEARCH_QUERIES = 4;
const MAX_CANDIDATE_FETCHES = 6;

// ── Text helpers ──

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

/** Whole-word test, so "Dolo" never matches "Dolopar" and "600" never "6000". */
function hasWord(haystack: string, word: string): boolean {
  if (!word) return false;
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(word)}(?![a-z0-9])`).test(
    haystack,
  );
}

function hasNumber(haystack: string, value: number): boolean {
  const text = Number.isInteger(value) ? String(value) : String(value);
  return new RegExp(`(?<![0-9])${escapeRegExp(text)}(?![0-9])`).test(haystack);
}

/** Dosage form words → one canonical form, so "Tablet(s)" matches "tablet". */
const FORM_CANONICAL: Record<string, string> = {
  tab: "tablet",
  tabs: "tablet",
  tablet: "tablet",
  tablets: "tablet",
  cap: "capsule",
  caps: "capsule",
  capsule: "capsule",
  capsules: "capsule",
  gel: "gel",
  gels: "gel",
  cream: "cream",
  creams: "cream",
  ointment: "ointment",
  lotion: "lotion",
  soap: "soap",
  shampoo: "shampoo",
  syrup: "syrup",
  susp: "suspension",
  suspension: "suspension",
  solution: "solution",
  oral: "oral",
  drop: "drops",
  drops: "drops",
  spray: "spray",
  injection: "injection",
  inj: "injection",
  powder: "powder",
  sachet: "sachet",
  granules: "granules",
  chewable: "chewable",
  mouthwash: "mouthwash",
  inhaler: "inhaler",
  balm: "balm",
  oil: "oil",
  patch: "patch",
  suppository: "suppository",
  device: "device",
  thermometer: "thermometer",
};

/** Pack words carry no product identity, so they never have to be matched. */
const STOP_WORDS = new Set([
  "of",
  "in",
  "and",
  "for",
  "the",
  "with",
  "a",
  "an",
  "pack",
  "packs",
  "box",
  "boxed",
  "jar",
  "bottle",
  "strip",
  "strips",
  "pouch",
  "tin",
  "refill",
  "combo",
  "set",
  "tube",
  "s",
  "ml",
  "gm",
  "g",
  "mg",
  "mcg",
  "kg",
  "iu",
  "new",
  "sealed",
  "value",
]);

type Dose = { value: number; unit: "mg" | "mcg" | "iu" | "bare" };

/**
 * Numbers in a product name. Dose numbers (mg/mcg/IU, or a bare tablet strength
 * such as "Dolo 650") identify the product and must match exactly. Gram/kilogram
 * and millilitre numbers are pack or container sizes — preferred, not required,
 * because the same product ships in many pack sizes.
 */
function readNumbers(text: string): { doses: Dose[]; packs: number[] } {
  const lower = text.toLowerCase();
  const doses: Dose[] = [];
  const packs: number[] = [];

  const withUnit = /(\d+(?:\.\d+)?)\s*(mg|mcg|iu|gm|g|kg|ml|l|%)/g;
  let match: RegExpExecArray | null;
  const consumed: Array<[number, number]> = [];
  while ((match = withUnit.exec(lower))) {
    const value = Number(match[1]);
    const unit = match[2];
    consumed.push([match.index, match.index + match[0].length]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (unit === "mg") doses.push({ value, unit: "mg" });
    else if (unit === "mcg") doses.push({ value, unit: "mcg" });
    else if (unit === "iu") doses.push({ value, unit: "iu" });
    else packs.push(value);
  }

  // Bare numbers ("Dolo 650", "Omez 20") are tablet strengths.
  const bare = /(?<![0-9.])(\d{2,4})(?![0-9.])/g;
  while ((match = bare.exec(lower))) {
    const start = match.index;
    const end = start + match[0].length;
    if (consumed.some(([from, to]) => start >= from && end <= to)) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) doses.push({ value, unit: "bare" });
  }

  return { doses, packs };
}

/** Mass in mg so "650 mg" and "0.65 g" compare equal. */
function massInMg(text: string): number[] {
  const lower = text.toLowerCase();
  const out: number[] = [];
  const pattern = /(\d+(?:\.\d+)?)\s*(mg|mcg|gm|g|kg)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(lower))) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    const unit = match[2];
    if (unit === "mg") out.push(value);
    else if (unit === "mcg") out.push(value / 1000);
    else if (unit === "gm" || unit === "g") out.push(value * 1000);
    else out.push(value * 1_000_000);
  }
  return out;
}

// ── Identity ──

export type ProductIdentity = {
  productName: string;
  brand?: string;
  manufacturer?: string;
  composition?: string;
  form?: string;
  strength?: string;
  packSize?: string;
};

type IdentityRules = {
  /** Brand words (or the leading name word): all must appear. */
  core: string[];
  /** Remaining meaningful name words: all must appear. */
  extra: string[];
  /** Dose numbers: must appear in the candidate. */
  doses: Dose[];
  /** Pack/container sizes: preferred, not required. */
  packs: number[];
  /** Form words typed in the name itself: must appear. */
  nameForms: string[];
  /** Form from the admin form: matched when the candidate states one. */
  form: string | null;
  manufacturerWords: string[];
  normalizedQuery: string;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function buildRules(identity: ProductIdentity): IdentityRules {
  const nameWords = words(identity.productName);
  const nameForms = unique(
    nameWords.filter((w) => FORM_CANONICAL[w]).map((w) => FORM_CANONICAL[w]),
  );
  const meaningful = nameWords.filter(
    (w) =>
      !FORM_CANONICAL[w] &&
      !STOP_WORDS.has(w) &&
      !/^\d/.test(w) &&
      w.length > 1,
  );

  const brandWords = identity.brand
    ? words(identity.brand).filter((w) => !STOP_WORDS.has(w) && w.length > 1)
    : [];
  const core = brandWords.length > 0 ? brandWords : meaningful.slice(0, 1);
  const extra = meaningful.filter((w) => !core.includes(w));

  // Dose numbers identify the product and are matched exactly. Pack sizes are
  // a preference only: the same product ships in many pack sizes, so a
  // disagreement must never reject an otherwise exact match.
  const nameNumbers = readNumbers(identity.productName);
  const strengthNumbers = readNumbers(identity.strength ?? "");
  const packNumbers = readNumbers(identity.packSize ?? "");

  const doses: Dose[] = [...nameNumbers.doses];
  for (const dose of strengthNumbers.doses) {
    if (!doses.some((d) => d.value === dose.value && d.unit === dose.unit)) {
      doses.push(dose);
    }
  }

  return {
    core,
    extra,
    doses,
    packs: unique([
      ...nameNumbers.packs,
      ...packNumbers.packs,
      ...packNumbers.doses.map((dose) => dose.value),
    ]).filter((value) => value > 0),
    nameForms,
    form: identity.form ? FORM_CANONICAL[normalize(identity.form)] ?? null : null,
    manufacturerWords: identity.manufacturer
      ? words(identity.manufacturer).filter((w) => w.length > 3)
      : [],
    normalizedQuery: normalize(
      [identity.productName, identity.brand, identity.manufacturer]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

// ── Candidates ──

type CandidateImage = { url: string; face?: string };

type Candidate = {
  name: string;
  slug?: string;
  manufacturer?: string;
  packText?: string;
  images: CandidateImage[];
};

type RawRecord = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Every product record on the page: name plus at least one image or slug. */
function collectRecords(root: unknown): RawRecord[] {
  const found: RawRecord[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown, depth: number) => {
    if (depth > 10 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const record = node as RawRecord;
    if (seen.has(record)) return;
    seen.add(record);
    if (
      asString(record.name) &&
      (asString(record.image) ||
        Array.isArray(record.damImages) ||
        asString(record.slug))
    ) {
      found.push(record);
    }
    for (const value of Object.values(record)) walk(value, depth + 1);
  };
  walk(root, 0);
  return found;
}

function imagesOf(record: RawRecord): CandidateImage[] {
  const images: CandidateImage[] = [];
  const dam = record.damImages;
  if (Array.isArray(dam)) {
    for (const entry of dam) {
      if (entry && typeof entry === "object") {
        const url = asString((entry as RawRecord).url);
        if (url) {
          images.push({ url, face: asString((entry as RawRecord).face) });
        }
      }
    }
  }
  const single = asString(record.image);
  if (single) images.push({ url: single });
  return images;
}

function toCandidate(record: RawRecord): Candidate | null {
  const name = asString(record.name);
  if (!name) return null;
  const packText = [
    asString(record.measurementUnit),
    asString(record.subtitleText),
    asString(record.packQuantityValue),
  ]
    .filter(Boolean)
    .join(" ");
  return {
    name,
    slug: asString(record.slug),
    manufacturer: asString(record.manufacturer),
    packText: packText || undefined,
    images: imagesOf(record),
  };
}

// ── Scoring / exact-match verification ──

const BAD_IMAGE_PATTERNS =
  /(logo|icon|sprite|favicon|banner|promo|offer|discount|doctor|nurse|patient|clinic|hospital|blog|article|video|prescri|placeholder|avatar|flag|payment|wallet|bankicon|illustration|molecule|skeletal|chemical|structure|diagram|formula|packshot-placeholder)/i;

/** Files that can never be a product photo. */
function isUsableImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (!/^https:\/\//.test(lower)) return false;
  if (!/\.(jpg|jpeg|png|webp)(\?|$)/.test(lower)) return false;
  // The CDN names watermarked assets "…-non-watermark.jpg"; ignore that word so
  // the clean packshot is not filtered out by the "watermark" check.
  const name = lower.replace(/non-watermark/g, "").replace(/productsnowatermark/g, "");
  return !BAD_IMAGE_PATTERNS.test(name);
}

function imageScore(image: CandidateImage, name: string): number {
  const lower = image.url.toLowerCase();
  let score = 0;
  const face = (image.face ?? "").toLowerCase();
  if (face === "front" || lower.includes("-front")) score += 3;
  else if (face === "back" || face === "side") score -= 1;
  if (lower.includes("productsnowatermark")) score += 2;
  else if (lower.includes("-non-watermark")) score += 2;
  if (lower.includes("/dam/products/")) score += 1;
  if (lower.includes("zoomed")) score -= 1;
  const wordsInName = name.length / 20;
  score -= wordsInName * 0.1;
  return score;
}

/** The best image for a candidate, normalised to a card-sized CDN render. */
function bestImage(candidate: Candidate): string | null {
  const ranked = candidate.images
    .filter((image) => isUsableImageUrl(image.url))
    .map((image) => ({ url: normalizeImageUrl(image.url), image }))
    .filter((entry): entry is { url: string; image: CandidateImage } => !!entry.url)
    .sort((a, b) => imageScore(b.image, candidate.name) - imageScore(a.image, candidate.name));
  return ranked[0]?.url ?? null;
}

/** Card-sized render, preferring the un-watermarked asset path. */
function normalizeImageUrl(url: string): string | null {
  const base = url.split("?")[0];
  if (!base) return null;
  const clean = base.includes("-non-watermark")
    ? base.replace("/dam/products/", "/dam/productsnowatermark/")
    : base;
  return `${clean}?dim=${IMAGE_DIM}&q=80`;
}

type ScoredCandidate = { candidate: Candidate; score: number; reasons: string[] };

/**
 * Verify a candidate against the identity. Returns null when the candidate is
 * not the exact same product — this is the check that stops Dolo 500, Dolo
 * Cold, "Dolopar 650" or a generic paracetamol pack from being used for
 * "Dolo 650".
 */
function scoreCandidate(
  candidate: Candidate,
  rules: IdentityRules,
): ScoredCandidate | null {
  const name = normalize(candidate.name);
  const reasons: string[] = [];

  for (const word of rules.core) {
    if (!hasWord(name, word)) return null;
  }
  reasons.push(`brand:${rules.core.join("+")}`);

  const missingExtra = rules.extra.filter((word) => !hasWord(name, word));
  if (missingExtra.length > 0) return null;
  if (rules.extra.length > 0) reasons.push(`name:${rules.extra.join("+")}`);

  const masses = massInMg(candidate.name);
  for (const dose of rules.doses) {
    const matched =
      dose.unit === "bare"
        ? hasNumber(name, dose.value) ||
          masses.some((mass) => Math.abs(mass - dose.value) < 0.01)
        : dose.unit === "mg"
          ? masses.some((mass) => Math.abs(mass - dose.value) < 0.01)
          : hasNumber(name, dose.value);
    if (!matched) return null;
  }
  if (rules.doses.length > 0) {
    reasons.push(
      `dose:${rules.doses.map((d) => `${d.value}${d.unit}`).join(",")}`,
    );
  }

  const candidateForms = unique(
    words(candidate.name)
      .filter((w) => FORM_CANONICAL[w])
      .map((w) => FORM_CANONICAL[w]),
  );
  for (const form of rules.nameForms) {
    if (!candidateForms.includes(form)) return null;
  }

  let score = 6;
  const packText = `${candidate.packText ?? ""} ${candidate.name}`;
  if (candidateForms.length > 0) {
    if (rules.form && candidateForms.includes(rules.form)) score += 2;
    else if (rules.form && !candidateForms.includes(rules.form)) score -= 3;
  }

  const packHaystack = normalize(`${candidate.name} ${candidate.packText ?? ""}`);
  const matchedPacks = rules.packs.filter((value) =>
    hasNumber(packHaystack, value),
  );
  if (matchedPacks.length > 0) {
    score += 2;
    reasons.push("pack-size");
  }

  if (rules.manufacturerWords.length > 0 && candidate.manufacturer) {
    const candidateManufacturer = normalize(candidate.manufacturer);
    const overlap = rules.manufacturerWords.filter((word) =>
      candidateManufacturer.includes(word),
    );
    if (overlap.length > 0) {
      score += 3;
      reasons.push("manufacturer");
    } else {
      score -= 4;
    }
  }

  // A candidate whose record repeats the typed query almost verbatim is the
  // closest thing to the product the admin asked for.
  const extraWords = words(packText).filter((w) => !rules.core.includes(w));
  score -= Math.min(extraWords.length, 10) * 0.1;

  return { candidate, score, reasons };
}

/**
 * Exported for tests: does this candidate product name belong to this exact
 * product? Runs the same rules the pipeline applies (brand and name words as
 * whole words, dose strength exact) and ignores images.
 */
export function matchesProductIdentity(
  candidateName: string,
  identity: ProductIdentity,
  candidateManufacturer?: string,
): boolean {
  const rules = buildRules(identity);
  if (rules.core.length === 0) return false;
  return (
    scoreCandidate(
      {
        name: candidateName,
        manufacturer: candidateManufacturer,
        images: [],
      },
      rules,
    ) !== null
  );
}

// ── Network ──

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function nextData(html: string): unknown | null {
  const match = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Every search query worth trying, most specific first, ending with the plain
 * leading word so a long name ("Ensure Diabetes Care 950g") still finds the
 * product whose catalogue title is worded differently.
 */
function searchQueries(identity: ProductIdentity): string[] {
  const queries: string[] = [];
  const push = (value: string) => {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (
      trimmed.length > 1 &&
      !queries.some((q) => q.toLowerCase() === trimmed.toLowerCase())
    ) {
      queries.push(trimmed);
    }
  };

  const name = identity.productName.trim();
  const leading = words(name)[0] ?? name;

  push([name, identity.form].filter(Boolean).join(" "));
  push([name, identity.strength].filter(Boolean).join(" "));
  push(name);
  push([leading, identity.strength].filter(Boolean).join(" "));
  push(leading);
  return queries.slice(0, MAX_SEARCH_QUERIES);
}

async function searchCandidates(query: string): Promise<Candidate[]> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${PHARMEASY_SEARCH}${encodeURIComponent(query)}`, {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  let html: string;
  try {
    html = await response.text();
  } catch {
    return [];
  }
  const data = nextData(html);
  if (!data) return [];
  return collectRecords(data)
    .map(toCandidate)
    .filter((candidate): candidate is Candidate => candidate !== null);
}

function looksLikeImage(bytes: Uint8Array, contentType: string): boolean {
  if (!contentType.startsWith("image/")) {
    // Some CDNs answer without a content type; the magic bytes still decide.
    if (contentType && !contentType.startsWith("application/octet")) return false;
  }
  const [a, b, c, d] = bytes;
  const jpeg = a === 0xff && b === 0xd8 && c === 0xff;
  const png = a === 0x89 && b === 0x50 && c === 0x4e && d === 0x47;
  const gif = a === 0x47 && b === 0x49 && c === 0x46;
  const webp = a === 0x52 && b === 0x49 && c === 0x46 && d === 0x46;
  return jpeg || png || gif || webp;
}

type DownloadedImage = {
  bytes: Uint8Array;
  contentType: string;
  sourceUrl: string;
};

async function downloadImage(
  url: string,
  originalUrl: string,
): Promise<DownloadedImage | null> {
  const attempt = async (target: string): Promise<DownloadedImage | null> => {
    let response: Response;
    try {
      response = await fetchWithTimeout(target, {
        "user-agent": USER_AGENT,
        accept: "image/*,*/*",
        referer: "https://pharmeasy.in/",
      });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
    if (bytes.byteLength < MIN_IMAGE_BYTES) return null;
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    if (!looksLikeImage(bytes, contentType)) return null;
    return {
      bytes,
      contentType: contentType.startsWith("image/") ? contentType : "image/jpeg",
      sourceUrl: target,
    };
  };

  const resized = await attempt(url);
  if (resized) return resized;
  // Fall back to the untouched asset when the resized or un-watermarked path
  // is not served.
  if (originalUrl !== url) return await attempt(originalUrl);
  return null;
}

// ── Core ──

export type ProductImageOutcome =
  | {
      ok: true;
      imageUrl: string;
      matchedName: string;
      source: string;
      sourceUrl: string;
      notes: string[];
    }
  | { ok: false; message: string; considered: string[] };

/**
 * Resolve, verify, download and store the image for one product identity.
 * Shared by the admin action and the backfill pass so both behave identically.
 */
export async function resolveAndStore(
  ctx: ActionCtx,
  identity: ProductIdentity,
): Promise<ProductImageOutcome> {
  const rules = buildRules(identity);
  if (rules.core.length === 0) {
    return {
      ok: false,
      message: "Enter the product name before fetching its image.",
      considered: [],
    };
  }

  const considered: string[] = [];
  let fetches = 0;

  for (const query of searchQueries(identity)) {
    const candidates = await searchCandidates(query);
    if (candidates.length === 0) continue;

    const scored: ScoredCandidate[] = [];
    for (const candidate of candidates) {
      const result = scoreCandidate(candidate, rules);
      if (result) scored.push(result);
    }
    scored.sort((a, b) => b.score - a.score);

    for (const entry of scored) {
      if (fetches >= MAX_CANDIDATE_FETCHES) break;
      const candidateUrl = bestImage(entry.candidate);
      if (!candidateUrl) continue;
      fetches += 1;
      considered.push(entry.candidate.name);

      const rawUrl = entry.candidate.images[0]?.url ?? candidateUrl;
      const downloaded = await downloadImage(candidateUrl, rawUrl.split("?")[0]);
      if (!downloaded) continue;

      const storageId = await ctx.storage.store(
        new Blob([downloaded.bytes.buffer as ArrayBuffer], {
          type: downloaded.contentType,
        }),
      );
      const publicUrl = await ctx.storage.getUrl(storageId);
      if (!publicUrl) continue;

      return {
        ok: true,
        imageUrl: publicUrl,
        matchedName: entry.candidate.name,
        source: "pharmeasy",
        sourceUrl: entry.candidate.slug
          ? `https://pharmeasy.in/online-medicine-order/${entry.candidate.slug}`
          : downloaded.sourceUrl,
        notes: entry.reasons,
      };
    }
  }

  return {
    ok: false,
    message: "Exact product image could not be verified.",
    considered: unique(considered).slice(0, 5),
  };
}

/**
 * Public entry point used by the admin Add/Edit Product dialog. Requires an
 * authenticated admin, because it writes the verified image into storage.
 */
export const resolveProductImage = action({
  args: {
    productName: v.string(),
    brand: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    composition: v.optional(v.string()),
    form: v.optional(v.string()),
    strength: v.optional(v.string()),
    packSize: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const isAdmin = await ctx.runQuery(internal.adminProducts.isAdminUser, {});
    if (!isAdmin) throw new Error("Not authorized");
    return await resolveAndStore(ctx, args);
  },
});

/** Same pipeline, callable from the CLI and by the backfill pass. */
export const resolveImage = internalAction({
  args: {
    productName: v.string(),
    brand: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    composition: v.optional(v.string()),
    form: v.optional(v.string()),
    strength: v.optional(v.string()),
    packSize: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await resolveAndStore(ctx, args);
  },
});

// ── Stored-image audit ──

/**
 * A verified product image is one this pipeline stored in Convex storage, so it
 * is permanent and known to be a real packshot. Everything else — empty, a
 * generated `data:` placeholder, a chemical structure pulled from Wikipedia, or
 * any other third-party URL — is an image the admin should re-resolve.
 */
export function isVerifiedProductImage(url: string | null | undefined): boolean {
  const value = (url ?? "").trim();
  return /^https:\/\/[a-z0-9-]+\.convex\.cloud\/api\/storage\//i.test(value);
}

export function needsProductImageRepair(url: string | null | undefined): boolean {
  const value = (url ?? "").trim();
  if (!value) return true;
  if (!/^https?:\/\//i.test(value)) return true;
  return !isVerifiedProductImage(value);
}
