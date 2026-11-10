import { describe, expect, it } from "vitest";
import { loadPrescriptionUsage } from "@/convex/prescriptionServer";

const DAY = 24 * 60 * 60 * 1000;

type Doc = Record<string, any>;

function makeCtx(docs: Doc[], orders: Doc[] = []) {
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  let linkedPrescriptionId: string | undefined;

  return {
    db: {
      get: async (id: string) => byId.get(String(id)) ?? null,
      query: () => ({
        withIndex: (_index: string, build: (q: any) => any) => {
          const q: any = {
            eq: (_field: string, value: string) => {
              linkedPrescriptionId = String(value);
              return q;
            },
          };
          build(q);
          return {
            collect: async () =>
              orders.filter(
                (order) =>
                  String(order.prescriptionId) === String(linkedPrescriptionId),
              ),
          };
        },
      }),
    },
  } as any;
}

function prescription(overrides: Doc = {}): Doc {
  return {
    _id: "rx1",
    userId: "user1",
    patientName: "Asha",
    fileId: "file1",
    fileName: "rx.jpg",
    fileType: "image/jpeg",
    fileSize: 1000,
    status: "approved",
    prescriptionDate: Date.now() - 10 * DAY,
    createdAt: Date.now() - 9 * DAY,
    auditLog: "[]",
    ...overrides,
  };
}

describe("loadPrescriptionUsage", () => {
  it("refuses a prescription that belongs to another customer", async () => {
    const ctx = makeCtx([prescription({ userId: "someone-else" })]);
    await expect(
      loadPrescriptionUsage(ctx, "user1" as any, "rx1" as any, ["medicine-a"]),
    ).rejects.toThrow(/not found in your account/i);
  });

  it("accepts an approved, unexpired prescription for its first order", async () => {
    const ctx = makeCtx([prescription()]);
    const { usage } = await loadPrescriptionUsage(
      ctx,
      "user1" as any,
      "rx1" as any,
      ["medicine-a"],
    );
    expect(usage.usable).toBe(true);
    expect(usage.firstUse).toBe(true);
  });

  it("collects only prescription-required medicines from linked orders", async () => {
    const ctx = makeCtx(
      [
        prescription(),
        { _id: "product-a", prescriptionRequired: true },
        { _id: "product-b", prescriptionRequired: true },
        { _id: "product-otc", prescriptionRequired: false },
      ],
      [
        {
          prescriptionId: "rx1",
          items: [
            { productId: "product-a" },
            { productId: "product-otc" },
          ],
        },
      ],
    );
    const { usage } = await loadPrescriptionUsage(
      ctx,
      "user1" as any,
      "rx1" as any,
      ["product-b"],
    );
    expect(usage.firstUse).toBe(false);
    expect(usage.usable).toBe(false);
    expect(usage.reason).toMatch(/different medicines/);
  });

  it("allows reusing the same medicine from a linked order", async () => {
    const ctx = makeCtx(
      [
        prescription(),
        { _id: "product-a", prescriptionRequired: true },
      ],
      [{ prescriptionId: "rx1", items: [{ productId: "product-a" }] }],
    );
    const { usage } = await loadPrescriptionUsage(
      ctx,
      "user1" as any,
      "rx1" as any,
      ["product-a"],
    );
    expect(usage.usable).toBe(true);
  });
});
