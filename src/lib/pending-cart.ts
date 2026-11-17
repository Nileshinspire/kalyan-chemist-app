/**
 * Guest add-to-cart hand-off.
 *
 * The cart itself is account-scoped on the server (`cart.addItem` requires the
 * authenticated user), so a signed-out visitor cannot have server cart lines.
 * When a guest adds a product we therefore keep that choice in the browser and
 * hand it over the moment they finish signing in — the same one cart, same
 * quantities, no second cart or duplicate storage system.
 */

const STORAGE_KEY = "kc_pending_cart";
const MAX_LINES = 20;
const MAX_QUANTITY = 10;

export interface PendingCartLine {
  productId: string;
  quantity: number;
}

function readRaw(): PendingCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (line): line is PendingCartLine =>
          Boolean(line) &&
          typeof line.productId === "string" &&
          line.productId.length > 0 &&
          typeof line.quantity === "number" &&
          Number.isFinite(line.quantity) &&
          line.quantity > 0,
      )
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

function writeRaw(lines: PendingCartLine[]) {
  if (typeof window === "undefined") return;
  try {
    if (lines.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked — the guest simply has nothing staged.
  }
}

export function readPendingCart(): PendingCartLine[] {
  return readRaw();
}

/** Remember one guest selection, merging it with anything already staged. */
export function stagePendingCartLine(productId: string, quantity = 1) {
  const lines = readRaw();
  const existing = lines.find((line) => line.productId === productId);
  if (existing) {
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
  } else {
    if (lines.length >= MAX_LINES) return;
    lines.push({ productId, quantity: Math.min(MAX_QUANTITY, quantity) });
  }
  writeRaw(lines);
}

export function clearPendingCart() {
  writeRaw([]);
}
