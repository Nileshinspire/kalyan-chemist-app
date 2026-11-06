import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { notifyRestockWaiters } from "@/convex/restockAlerts";

const PRODUCT_ID = "p1" as Id<"products">;

type Row = Record<string, any>;

/**
 * Minimal in-memory stand-in for the bits of MutationCtx the restock helper
 * uses: get / insert / patch / query().withIndex(). Same semantics for our
 * purposes, so the test exercises the real helper rather than a copy of it.
 */
function makeCtx(tables: Record<string, Row[]>) {
  let sequence = 0;
  const inserted: { table: string; doc: Row }[] = [];
  const data: Record<string, Row[]> = Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]),
  );

  const db = {
    get: async (id: string) => {
      for (const rows of Object.values(data)) {
        const found = rows.find((row) => row._id === id);
        if (found) return found;
      }
      return null;
    },
    insert: async (table: string, doc: Row) => {
      const id = `${table}_${++sequence}`;
      data[table] ??= [];
      data[table].push({ _id: id, ...doc });
      inserted.push({ table, doc: { _id: id, ...doc } });
      return id;
    },
    patch: async (id: string, patch: Row) => {
      for (const rows of Object.values(data)) {
        const row = rows.find((candidate) => candidate._id === id);
        if (row) {
          Object.assign(row, patch);
          return;
        }
      }
      throw new Error(`missing row ${id}`);
    },
    query: (table: string) => ({
      withIndex: (_name: string, build: (q: any) => any) => {
        const conditions: { field: string; value: unknown }[] = [];
        const q: any = {
          eq: (field: string, value: unknown) => {
            conditions.push({ field, value });
            return q;
          },
        };
        build(q);
        return {
          collect: async () =>
            (data[table] ?? []).filter((row) =>
              conditions.every(({ field, value }) => row[field] === value),
            ),
        };
      },
    }),
  };

  return { ctx: { db } as any, data, inserted };
}

describe("restock alerts", () => {
  const product = {
    _id: "p1",
    name: "Metformin 500 mg",
    slug: "metformin-500",
    stockQuantity: 12,
  };

  it("notifies only the waiting customers of that product", async () => {
    const { ctx, data, inserted } = makeCtx({
      products: [product],
      availability_notifications: [
        { _id: "a1", userId: "u1", productId: "p1", productName: product.name, status: "waiting" },
        { _id: "a2", userId: "u2", productId: "p2", productName: "Other", status: "waiting" },
        { _id: "a3", userId: "u3", productId: "p1", productName: product.name, status: "notified" },
      ],
      notifications: [],
    });

    const result = await notifyRestockWaiters(ctx, PRODUCT_ID);

    expect(result.notified).toBe(1);
    const waitingRows = data.availability_notifications;
    expect(waitingRows.find((r) => r._id === "a1")).toMatchObject({
      status: "notified",
      notifiedAt: expect.any(Number),
    });
    // The other product's waiter and the already-notified row are untouched.
    expect(waitingRows.find((r) => r._id === "a2")?.status).toBe("waiting");
    expect(waitingRows.find((r) => r._id === "a3")?.notifiedAt).toBeUndefined();

    const notifications = inserted.filter((row) => row.table === "notifications");
    expect(notifications).toHaveLength(1);
    expect(notifications[0].doc).toMatchObject({
      userId: "u1",
      title: "Metformin 500 mg is back in stock",
      link: "/products/metformin-500",
      read: false,
    });
  });

  it("is idempotent: a second run creates no duplicate notification", async () => {
    const { ctx, inserted } = makeCtx({
      products: [product],
      availability_notifications: [
        { _id: "a1", userId: "u1", productId: "p1", productName: product.name, status: "waiting" },
      ],
      notifications: [],
    });

    expect((await notifyRestockWaiters(ctx, PRODUCT_ID)).notified).toBe(1);
    expect((await notifyRestockWaiters(ctx, PRODUCT_ID)).notified).toBe(0);
    expect(inserted.filter((row) => row.table === "notifications")).toHaveLength(1);
  });

  it("does nothing while the product is still out of stock", async () => {
    const { ctx, inserted } = makeCtx({
      products: [{ ...product, stockQuantity: 0 }],
      availability_notifications: [
        { _id: "a1", userId: "u1", productId: "p1", productName: product.name, status: "waiting" },
      ],
      notifications: [],
    });

    expect((await notifyRestockWaiters(ctx, PRODUCT_ID)).notified).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("never sends more than one notification to a customer with legacy duplicate rows", async () => {
    const { ctx, inserted } = makeCtx({
      products: [product],
      availability_notifications: [
        { _id: "a1", userId: "u1", productId: "p1", productName: product.name, status: "waiting" },
        { _id: "a2", userId: "u1", productId: "p1", productName: product.name, status: "waiting" },
      ],
      notifications: [],
    });

    const result = await notifyRestockWaiters(ctx, PRODUCT_ID);
    expect(result.notified).toBe(2);
    expect(inserted.filter((row) => row.table === "notifications")).toHaveLength(1);
  });
});
