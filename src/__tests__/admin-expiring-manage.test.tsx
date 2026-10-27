import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { queryData, mutate, productsById, calls } = vi.hoisted(() => ({
  queryData: new Map<unknown, unknown>(),
  mutate: vi.fn().mockResolvedValue({ success: true }),
  productsById: new Map<string, unknown>(),
  calls: [] as { name: string; args: any }[],
}));

const fnName = (reference: any) => reference?.[Symbol.for("functionName")];

vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: any) => {
    if (args === "skip") return undefined;
    const name = fnName(query);
    if (name === "adminProducts:get") {
      return productsById.has(args?.productId) ? productsById.get(args?.productId) : null;
    }
    return queryData.get(name);
  },
  useMutation: (mutation: unknown) => (args: any) => {
    calls.push({ name: fnName(mutation), args });
    return mutate(args);
  },
  useAction: () => vi.fn().mockResolvedValue({}),
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  default: ({ children }: { children: any }) => (
    <div data-testid="admin-layout">{children}</div>
  ),
}));

import AdminExpiringMedicines from "@/pages/admin/AdminExpiringMedicines";

const now = Date.now();
const DAY = 86_400_000;

/** yyyy-mm-dd in local time — mirrors the page's toDateInputValue. */
function toDateInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const expiredRow = {
  _id: "p-expired",
  name: "glucon-D",
  imageUrl: undefined,
  expiryDate: now - 40 * DAY,
  stockQuantity: 20,
  expiryStatus: "expired",
  daysUntilExpiry: -40,
  categoryName: "Nutrition",
  manufacturer: "sun pharma",
};

const expiringRow = {
  _id: "p-expiring",
  name: "Azithral 500",
  imageUrl: undefined,
  expiryDate: now + 30 * DAY,
  stockQuantity: 5,
  expiryStatus: "expiring_soon",
  daysUntilExpiry: 30,
  categoryName: "Antibiotics",
  manufacturer: "Alembic",
};

const expiredFull = {
  _id: "p-expired",
  name: "glucon-D",
  manufacturer: "sun pharma",
  categoryName: "Nutrition",
  brandName: null,
  price: 120,
  discountPrice: 110,
  packSize: "1 kg",
  imageUrl: undefined,
  expiryDate: now - 40 * DAY,
  stockQuantity: 20,
};

const expiringFull = {
  _id: "p-expiring",
  name: "Azithral 500",
  manufacturer: "Alembic",
  categoryName: "Antibiotics",
  brandName: "Alembic",
  price: 300,
  discountPrice: undefined,
  packSize: "Strip of 5",
  imageUrl: undefined,
  expiryDate: now + 30 * DAY,
  stockQuantity: 5,
};

beforeEach(() => {
  mutate.mockClear();
  calls.length = 0;
  queryData.clear();
  productsById.clear();
});

describe("AdminExpiringMedicines — Manage dialog", () => {
  it("opens the clicked medicine's own management view (per-product binding)", () => {
    queryData.set("adminProducts:getExpiringMedicines", [expiringRow, expiredRow]);
    queryData.set("adminProducts:getExpiringMedicinesCount", {
      expired: 1,
      expiringSoon: 1,
      total: 2,
    });
    productsById.set("p-expired", expiredFull);
    productsById.set("p-expiring", expiringFull);

    render(<AdminExpiringMedicines />);
    const manageButtons = screen.getAllByRole("button", { name: /Manage/ });
    expect(manageButtons).toHaveLength(2);

    // First Manage (Azithral row) opens Azithral's own dialog.
    fireEvent.click(manageButtons[0]);
    expect(
      screen.getByRole("heading", { name: /Azithral 500/ })
    ).toBeTruthy();
    // Seeded from the clicked product's own record.
    expect((screen.getByLabelText(/Expiry date/) as HTMLInputElement).value).toBe(
      toDateInputValue(expiringRow.expiryDate)
    );
    expect((screen.getByLabelText(/Stock quantity/) as HTMLInputElement).value).toBe("5");
    // Opening the dialog never writes anything.
    expect(mutate).not.toHaveBeenCalled();

    // Close it, then the SECOND Manage must open the OTHER medicine's dialog
    // (loaded by its own product id) — not Add Product, not the first row.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Manage/ })[1]);
    expect(screen.getByRole("heading", { name: /glucon-D/ })).toBeTruthy();
    expect((screen.getByLabelText(/Expiry date/) as HTMLInputElement).value).toBe(
      toDateInputValue(expiredRow.expiryDate)
    );
    expect((screen.getByLabelText(/Stock quantity/) as HTMLInputElement).value).toBe("20");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows a prominent expired status and removes expired stock through the existing mutation", async () => {
    queryData.set("adminProducts:getExpiringMedicines", [expiredRow]);
    queryData.set("adminProducts:getExpiringMedicinesCount", {
      expired: 1,
      expiringSoon: 0,
      total: 1,
    });
    productsById.set("p-expired", expiredFull);

    render(<AdminExpiringMedicines />);
    fireEvent.click(screen.getAllByRole("button", { name: /Manage/ })[0]);

    // Status derived from the stored date, with the safety explanation.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Expired", { selector: "span" })).toBeTruthy();
    expect(screen.getByText(/Expired — not available for sale/)).toBeTruthy();
    expect(screen.getByText(/blocked from the storefront cart and checkout/)).toBeTruthy();
    expect((screen.getByLabelText(/Expiry date/) as HTMLInputElement).value).toBe(
      toDateInputValue(expiredFull.expiryDate)
    );
    expect(screen.getByText(/Status is calculated from this date/)).toBeTruthy();

    // Stock-handling action for expired medicine.
    const removeBtn = screen.getByRole("button", {
      name: /Mark expired stock as removed/,
    });
    fireEvent.click(removeBtn);
    expect(calls).toEqual([
      {
        name: "adminInventory:adjustStock",
        args: {
          productId: "p-expired",
          newQuantity: 0,
          reason: "Expired stock removed from sale (Expiring Medicines)",
        },
      },
    ]);
    // The input reseeds to 0 once the mutation settles (async continuation).
    await waitFor(() =>
      expect((screen.getByLabelText(/Stock quantity/) as HTMLInputElement).value).toBe("0")
    );
  });

  it("saves expiry and stock edits to the same existing product record", async () => {
    queryData.set("adminProducts:getExpiringMedicines", [expiringRow]);
    queryData.set("adminProducts:getExpiringMedicinesCount", {
      expired: 0,
      expiringSoon: 1,
      total: 1,
    });
    productsById.set("p-expiring", expiringFull);

    render(<AdminExpiringMedicines />);
    fireEvent.click(screen.getAllByRole("button", { name: /Manage/ })[0]);

    // Expiring-soon state (not expired): no stock-removal action offered.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Expiring Soon", { selector: "span" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Mark expired stock as removed/ })
    ).toBeNull();

    const newDate = toDateInputValue(now + 200 * DAY);
    fireEvent.change(screen.getByLabelText(/Expiry date/), {
      target: { value: newDate },
    });
    fireEvent.change(screen.getByLabelText(/Stock quantity/), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    // Both mutations run from the same save handler, the second after the
    // first one's await — wait for the pair to be issued.
    await waitFor(() =>
      expect(calls).toEqual([
      {
        name: "adminInventory:updateExpiry",
        args: {
          productId: "p-expiring",
          expiryDate: new Date(`${newDate}T00:00:00`).getTime(),
        },
      },
      {
        name: "adminInventory:adjustStock",
        args: {
          productId: "p-expiring",
          newQuantity: 12,
          reason: "Stock updated from Expiring Medicines manage view",
        },
      },
    ]));
    // Save keeps the management view open for the same product.
    expect(screen.getByRole("heading", { name: /Azithral 500/ })).toBeTruthy();
  });

  it("shows a clear error with a way back when the medicine cannot be found", () => {
    queryData.set("adminProducts:getExpiringMedicines", [
      { ...expiredRow, _id: "p-deleted", name: "Deleted med" },
    ]);
    queryData.set("adminProducts:getExpiringMedicinesCount", {
      expired: 1,
      expiringSoon: 0,
      total: 1,
    });
    // "p-deleted" is intentionally absent from productsById → get returns null.

    render(<AdminExpiringMedicines />);
    fireEvent.click(screen.getAllByRole("button", { name: /Manage/ })[0]);

    expect(screen.getByText("Medicine not found")).toBeTruthy();
    expect(screen.getByText(/Return to the list/)).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Back to list" }));
    expect(screen.queryByText("Medicine not found")).toBeNull();
  });
});
