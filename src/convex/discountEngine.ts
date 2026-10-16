/**
 * Server-side discount engine — the only code that writes rule-driven prices.
 *
 * Everything here follows the shared pure engine in `@/lib/discount`. This
 * module adapts it to the database:
 *
 *   • `readEngine(db)`  — the stored config, shaped for the pure resolver (with
 *                         the promotion window resolved against the clock).
 *   • `syncProduct`     — writes the resolved price for ONE product (called from
 *                         the existing product create/update flows so a new
 *                         product is discounted automatically, with no admin
 *                         step).
 *   • `syncGoverned`    — reprices only the products a rule change can affect:
 *                         every engine-managed product plus every product the
 *                         new rules could newly govern. Independent,
 *                         admin-set selling prices are never touched.
 *   • `logEngineChange` — one audit row per config save, into the existing
 *                         `auditLogs` table.
 */
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  resolveProductDiscount,
  discountedPriceFor,
  normalizeDiscountPercent,
  type EngineConfigInput,
  type DiscountRow,
} from "../lib/discount";

export type DiscountEngineDoc =
  | Doc<"discountHighlights">
  | null;

/** Load the config row and shape it for the pure resolver. */
export async function readEngine(db: MutationCtx["db"] | QueryCtx["db"]): Promise<EngineConfigInput> {
  const row = await db.query("discountHighlights").first();
  if (!row) {
    return { isActive: false, discountPercent: 0 };
  }
  return {
    isActive: row.isActive ?? true,
    discountPercent: row.discountPercent ?? 0,
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
    excludedProductIds: (row.excludedProductIds ?? []) as string[],
    productOverrides: (row.productOverrides ?? []) as {
      productId: string;
      discountPercent: number;
    }[],
    categoryRules: (row.categoryRules ?? []) as {
      categoryId: string;
      discountPercent: number;
    }[],
    manualProductIds: (row.manualProductIds ?? []) as string[],
  };
}

/** The engine plus the effective "at time of read" moment. */
export async function loadEngine(db: MutationCtx["db"] | QueryCtx["db"]): Promise<{
  engine: EngineConfigInput;
  now: number;
}> {
  const engine = await readEngine(db);
  return { engine, now: Date.now() };
}

/**
 * The settlement price the backend charges for a product: resolved through the
 * engine, never from a client-supplied number.
 */
export async function engineEffectivePrice(
  db: MutationCtx["db"],
  product: Doc<"products">,
): Promise<{ unitPrice: number; percent: number }> {
  const { engine, now } = await loadEngine(db);
  const res = resolveProductDiscount(
    {
      _id: product._id,
      price: product.price,
      discountPrice: product.discountPrice ?? null,
      categoryId: product.categoryId,
      isActive: product.isActive,
      discountSource: product.discountSource ?? null,
    },
    engine,
    now,
  );
  return { unitPrice: res.effectivePrice, percent: res.percent };
}

/**
 * Reconcile ONE product with the engine. Writes only when the stored selling
 * price differs from what the engine resolves for it, and only into a product
 * the engine owns ("rule") or a fresh product. Never edits editorial
 * ("manual") prices.
 */
export async function syncProduct(
  ctx: Pick<MutationCtx, "db">,
  productId: Id<"products">,
): Promise<{ changed: boolean; status: string }> {
  const product = await ctx.db.get(productId);
  if (!product) return { changed: false, status: "missing" };
  const { engine, now } = await loadEngine(ctx.db);
  return await syncProductRow(ctx, product, engine, now);
}

async function syncProductRow(
  ctx: Pick<MutationCtx, "db">,
  product: Doc<"products">,
  engine: EngineConfigInput,
  now: number,
): Promise<{ changed: boolean; status: string }> {
  const row: DiscountRow = {
    _id: product._id,
    price: product.price,
    discountPrice: product.discountPrice ?? null,
    categoryId: product.categoryId,
    isActive: product.isActive,
    discountSource: product.discountSource ?? null,
  };
  const res = resolveProductDiscount(row, engine, now);

  // What the engine wants stored for this product.
  const governed =
    res.status === "override" || res.status === "category" || res.status === "auto";
  const shouldBeGoverned = governed;

  const stored = product.discountPrice ?? null;
  const storedSource = product.discountSource ?? null;

  if (shouldBeGoverned) {
    if (storedSource !== "rule" || stored !== res.effectivePrice) {
      await ctx.db.patch(product._id, {
        discountPrice: res.effectivePrice,
        discountSource: "rule",
        updatedAt: now,
      });
      return { changed: true, status: res.status };
    }
    return { changed: false, status: res.status };
  }

  // Not governed: the engine only cleans a price it wrote itself. An explicit
  // manual price (or a legacy price with no provenance) is left untouched.
  if (storedSource === "rule") {
    await ctx.db.patch(product._id, {
      discountPrice: undefined,
      discountSource: undefined,
      updatedAt: now,
    });
    return { changed: true, status: res.status };
  }
  return { changed: false, status: res.status };
}

/**
 * Reconcile every product the config change can affect: all engine-managed
 * products (they may need repricing or cleanup) plus all active products the
 * new rules could newly govern. Writes happen only when a value actually
 * changes, so a default-percent edit never rewrites the whole catalog and
 * never touches independent admin-priced products.
 */
export async function syncGoverned(
  ctx: MutationCtx,
): Promise<{ priced: number; cleaned: number; skipped: number }> {
  const { engine, now } = await loadEngine(ctx.db);
  const products = await ctx.db.query("products").collect();
  let priced = 0;
  let cleaned = 0;
  let skipped = 0;
  for (const product of products) {
    const storedSource = product.discountSource ?? null;
    const couldBeGoverned =
      storedSource === "rule" || engineCouldPrice(engine, product, now);
    if (!couldBeGoverned) {
      skipped += 1;
      continue;
    }
    const result = await syncProductRow(ctx, product, engine, now);
    if (result.changed) {
      if (result.status === "override" || result.status === "category" || result.status === "auto") {
        priced += 1;
      } else {
        cleaned += 1;
      }
    } else {
      skipped += 1;
    }
  }
  return { priced, cleaned, skipped };
}

/** Cheap membership test: could the engine currently price this product? */
function engineCouldPrice(
  engine: EngineConfigInput,
  product: Doc<"products">,
  now: number,
): boolean {
  if ((engine.productOverrides ?? []).some((o) => o.productId === product._id)) return true;
  if (!(engine.isActive !== false)) return false; // window closed → only rule rows need cleanup
  if (
    typeof engine.startsAt === "number" && now < engine.startsAt
  )
    return false;
  if (
    typeof engine.endsAt === "number" && now > engine.endsAt
  )
    return false;
  if ((engine.categoryRules ?? []).some((c) => c.categoryId === product.categoryId)) return true;
  const globalPercent = engine.discountPercent ?? 0;
  return Number.isInteger(globalPercent) && globalPercent >= 1;
}

/**
 * One auditable record per config save, into the existing `auditLogs` table,
 * using the same shape the other admin modules write.
 */
export async function logEngineChange(
  ctx: Pick<MutationCtx, "db">,
  adminId: Id<"users"> | null,
  adminName: string | null,
  summary: string,
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    action: "update",
    category: "Discount rules",
    item: "Discount engine configuration",
    details: summary,
    adminId: adminId ?? (("system" as unknown) as Id<"users">),
    adminName: adminName ?? undefined,
    timestamp: Date.now(),
  });
}

/**
 * Validate an incoming config payload. Throws with a clear message on the
 * first invalid value; returns the normalized values.
 */
export function validateRulePercents(
  values: number[],
  what: string,
): void {
  for (const value of values) {
    try {
      normalizeDiscountPercent(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${what}: ${message}`);
    }
  }
}

export { discountedPriceFor };
