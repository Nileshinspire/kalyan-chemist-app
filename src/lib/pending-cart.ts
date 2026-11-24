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
// The server performs the real stock check; this only keeps a guest's staged
// line sane. Kits can legitimately have more than ten complete units available.
const MAX_QUANTITY = 99;

export interface PendingCartLine {
  productId: string;
  quantity: number;
  /** Kept for guest-customized kits so sign-in does not lose the selection. */
  kitSelection?: Array<{ productId: string; quantity: number }>;
}

function selectionKey(line: PendingCartLine): string {
  return (line.kitSelection ?? [])
    .map((item) => `${item.productId}:${item.quantity}`)
    .join(",");
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
          line.quantity > 0 &&
          (line.kitSelection === undefined ||
            (Array.isArray(line.kitSelection) &&
              line.kitSelection.every(
                (item: any) =>
                  item &&
                  typeof item.productId === "string" &&
                  Number.isInteger(item.quantity) &&
                  item.quantity >= 0,
              ))),
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
export function stagePendingCartLine(
  productId: string,
  quantity = 1,
  kitSelection?: Array<{ productId: string; quantity: number }>,
) {
  const lines = readRaw();
  const candidate: PendingCartLine = { productId, quantity, ...(kitSelection ? { kitSelection } : {}) };
  const existing = lines.find(
    (line) => line.productId === productId && selectionKey(line) === selectionKey(candidate),
  );
  if (existing) {
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
  } else {
    if (lines.length >= MAX_LINES) return;
    lines.push({ ...candidate, quantity: Math.min(MAX_QUANTITY, quantity) });
  }
  writeRaw(lines);
}

export function clearPendingCart() {
  writeRaw([]);
}
