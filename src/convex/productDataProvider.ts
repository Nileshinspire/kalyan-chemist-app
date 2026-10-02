/**
 * ProductDataProvider — the provider abstraction for a licensed product API.
 *
 * The catalog is populated from the admin's licensed dataset import; this
 * adapter exists so a licensed provider API (e.g. Data Requisite) can be used
 * later without touching the Auto Fill or importer code. It is DISABLED unless
 * the operator explicitly configures it with environment variables:
 *
 *   LICENSED_PRODUCT_API_URL   base URL of the licensed provider API
 *   LICENSED_PRODUCT_API_KEY   API credential issued by that provider
 *
 * No credential is ever hardcoded, no subscription is created by this code,
 * and no request is made unless both values are present. When disabled,
 * `createProductDataProvider` returns null and every caller reports honestly
 * that no licensed provider is configured.
 */

/** A product record as a licensed provider returns it (subset of our fields). */
export type ProviderProductRecord = {
  sourceProductId?: string;
  name: string;
  brand?: string;
  manufacturer?: string;
  composition?: string;
  strength?: string;
  form?: string;
  packSize?: string;
  sku?: string;
  gtin?: string;
  category?: string;
  prescriptionRequired?: boolean;
  description?: string;
  benefits?: string;
  directions?: string;
  safety?: string;
  storage?: string;
  mrp?: number;
  sourceUrl?: string;
};

/** An image asset that belongs to exactly one provider record. */
export type ProviderImageAsset = {
  url?: string;
  filename?: string;
  sourceProductId?: string;
  sku?: string;
  gtin?: string;
};

/**
 * The four conceptual methods every provider must support. All of them are
 * keyed to the provider's own stable ids so a lookup can never drift onto a
 * different product.
 */
export type ProductDataProvider = {
  id: string;
  label: string;
  searchProducts(query: string, limit?: number): Promise<ProviderProductRecord[]>;
  getProduct(sourceProductId: string): Promise<ProviderProductRecord | null>;
  getProductById(id: string): Promise<ProviderProductRecord | null>;
  getProductImages(sourceProductId: string): Promise<ProviderImageAsset[]>;
};

export const PROVIDER_ENV_VARS = {
  url: "LICENSED_PRODUCT_API_URL",
  apiKey: "LICENSED_PRODUCT_API_KEY",
} as const;

export const PROVIDER_NOT_CONFIGURED_MESSAGE =
  "No licensed product provider API is configured.";

type EnvLike = Record<string, string | undefined>;

/** True only when both the URL and the credential are present. */
export function providerConfigured(env: EnvLike): boolean {
  return Boolean(
    (env[PROVIDER_ENV_VARS.url] ?? "").trim() &&
      (env[PROVIDER_ENV_VARS.apiKey] ?? "").trim(),
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const num = Number(value.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(num) && num > 0) return num;
    }
  }
  return undefined;
}

/** Tolerant mapping of provider JSON into our record shape. */
export function parseProviderRecord(raw: unknown): ProviderProductRecord | null {
  const source = asRecord(raw);
  if (!source) return null;
  const name =
    pickString(source, ["name", "productName", "product_name", "title", "brandName"]) ??
    null;
  if (!name) return null;
  const record: ProviderProductRecord = { name };
  const copy = <K extends keyof ProviderProductRecord>(
    key: K,
    keys: string[],
  ) => {
    const value = pickString(source, keys);
    if (value !== undefined) record[key] = value as ProviderProductRecord[K];
  };
  copy("sourceProductId", ["sourceProductId", "productId", "product_id", "id", "packId"]);
  copy("brand", ["brand", "brandName", "tradeName"]);
  copy("manufacturer", ["manufacturer", "company", "marketer", "marketedBy"]);
  copy("composition", ["composition", "ingredients", "saltComposition", "genericName"]);
  copy("strength", ["strength", "potency"]);
  copy("form", ["form", "dosageForm", "productForm"]);
  copy("packSize", ["packSize", "packaging", "package", "quantity"]);
  copy("sku", ["sku", "itemCode", "productCode"]);
  copy("gtin", ["gtin", "barcode", "ean"]);
  copy("category", ["category", "therapeuticClass"]);
  copy("description", ["description", "about"]);
  copy("benefits", ["benefits", "uses", "indications"]);
  copy("directions", ["directions", "howToUse", "usage"]);
  copy("safety", ["safety", "warnings", "sideEffects"]);
  copy("storage", ["storage", "storageInstructions"]);
  copy("sourceUrl", ["sourceUrl", "productUrl", "url"]);
  const rx = source["prescriptionRequired"] ?? source["rx"] ?? source["prescription"];
  if (typeof rx === "boolean") record.prescriptionRequired = rx;
  else if (typeof rx === "string") {
    const folded = rx.trim().toLowerCase();
    if (["rx", "yes", "true", "prescription", "prescription required"].includes(folded)) {
      record.prescriptionRequired = true;
    } else if (["otc", "no", "false"].includes(folded)) {
      record.prescriptionRequired = false;
    }
  }
  const mrp = pickNumber(source, ["mrp", "maximumRetailPrice", "price"]);
  if (mrp !== undefined) record.mrp = mrp;
  return record;
}

function parseProviderList(payload: unknown): ProviderProductRecord[] {
  const root = asRecord(payload);
  let list: unknown = payload;
  if (root) {
    for (const key of ["results", "records", "products", "data", "items"]) {
      if (Array.isArray(root[key])) {
        list = root[key];
        break;
      }
    }
  }
  if (!Array.isArray(list)) return [];
  const records: ProviderProductRecord[] = [];
  for (const entry of list) {
    const parsed = parseProviderRecord(entry);
    if (parsed) records.push(parsed);
  }
  return records;
}

function parseProviderImages(payload: unknown): ProviderImageAsset[] {
  const root = asRecord(payload);
  let list: unknown = payload;
  if (root) {
    for (const key of ["images", "results", "records", "data", "items"]) {
      if (Array.isArray(root[key])) {
        list = root[key];
        break;
      }
    }
  }
  if (!Array.isArray(list)) return [];
  const assets: ProviderImageAsset[] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      if (/^https?:\/\//i.test(entry)) assets.push({ url: entry });
      continue;
    }
    const source = asRecord(entry);
    if (!source) continue;
    const url = pickString(source, ["url", "imageUrl", "image_url", "src", "originalUrl"]);
    const filename = pickString(source, ["filename", "fileName", "name", "file"]);
    const sourceProductId = pickString(source, ["sourceProductId", "productId", "packId"]);
    const sku = pickString(source, ["sku", "itemCode"]);
    const gtin = pickString(source, ["gtin", "barcode", "ean"]);
    if (url || filename) assets.push({ url, filename, sourceProductId, sku, gtin });
  }
  return assets;
}

/**
 * Build the HTTP adapter for a licensed provider, or null when the provider
 * is not configured. Every request carries the credential from the
 * environment; nothing is subscribed to, purchased or invented here.
 */
export function createProductDataProvider(
  env: EnvLike,
): ProductDataProvider | null {
  const baseUrl = (env[PROVIDER_ENV_VARS.url] ?? "").trim().replace(/\/+$/, "");
  const apiKey = (env[PROVIDER_ENV_VARS.apiKey] ?? "").trim();
  if (!baseUrl || !apiKey) return null;

  const call = async (path: string): Promise<unknown> => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`licensed provider responded ${response.status}`);
    }
    return await response.json();
  };

  return {
    id: "licensed-provider",
    label: "Licensed product provider API",
    async searchProducts(query, limit = 8) {
      const payload = await call(
        `/products/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      );
      return parseProviderList(payload).slice(0, limit);
    },
    async getProduct(sourceProductId) {
      const payload = await call(
        `/products/${encodeURIComponent(sourceProductId)}`,
      );
      return parseProviderRecord(payload);
    },
    async getProductById(id) {
      const payload = await call(`/products/id/${encodeURIComponent(id)}`);
      return parseProviderRecord(payload);
    },
    async getProductImages(sourceProductId) {
      const payload = await call(
        `/products/${encodeURIComponent(sourceProductId)}/images`,
      );
      return parseProviderImages(payload);
    },
  };
}
