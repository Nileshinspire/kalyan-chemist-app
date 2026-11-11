import { describe, expect, it } from "vitest";
import {
  allocateFefo,
  expiredQuantity,
  sellableQuantity,
  sortBatchesFefo,
  unbatchedQuantity,
  type BatchStock,
} from "@/convex/batchAllocationCore";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 11); // 11 Nov 2026

function batch(overrides: Partial<BatchStock> & { _id: string }): BatchStock {
  return {
    availableQuantity: 0,
    expiryDate: null,
    stockReceivedAt: NOW - 30 * DAY,
    ...overrides,
  };
}

describe("FEFO batch ordering", () => {
  it("puts the earliest expiring sellable batch first", () => {
    const batches = [
      batch({ _id: "later", expiryDate: NOW + 300 * DAY, availableQuantity: 10 }),
      batch({ _id: "soonest", expiryDate: NOW + 30 * DAY, availableQuantity: 10 }),
      batch({ _id: "middle", expiryDate: NOW + 120 * DAY, availableQuantity: 10 }),
    ];

    expect(sortBatchesFefo(batches, NOW).map((b) => b._id)).toEqual([
      "soonest",
      "middle",
      "later",
    ]);
  });

  it("sorts an undated batch after every dated batch and ties break on receipt", () => {
    const batches = [
      batch({ _id: "undated", expiryDate: null, availableQuantity: 5 }),
      batch({ _id: "dated", expiryDate: NOW + 90 * DAY, availableQuantity: 5 }),
      batch({
        _id: "same-expiry-older",
        expiryDate: NOW + 90 * DAY,
        availableQuantity: 5,
        stockReceivedAt: NOW - 60 * DAY,
      }),
    ];

    expect(sortBatchesFefo(batches, NOW).map((b) => b._id)).toEqual([
      "same-expiry-older",
      "dated",
      "undated",
    ]);
  });

  it("excludes expired batches from the sellable list entirely", () => {
    const batches = [
      batch({ _id: "expired", expiryDate: NOW - DAY, availableQuantity: 50 }),
      batch({ _id: "valid", expiryDate: NOW + DAY, availableQuantity: 4 }),
    ];

    expect(sortBatchesFefo(batches, NOW).map((b) => b._id)).toEqual(["valid"]);
    expect(sellableQuantity(batches, 54, NOW)).toBe(4);
    expect(expiredQuantity(batches, NOW)).toBe(50);
  });

  it("treats a batch expiring exactly now as expired", () => {
    const batches = [
      batch({ _id: "today", expiryDate: NOW, availableQuantity: 7 }),
    ];

    expect(sellableQuantity(batches, 7, NOW)).toBe(0);
    expect(expiredQuantity(batches, NOW)).toBe(7);
  });

  it("holds back batches flagged for admin verification", () => {
    const batches = [
      batch({ _id: "unverified", availableQuantity: 9, needsVerification: true }),
      batch({ _id: "ok", expiryDate: NOW + 100 * DAY, availableQuantity: 2 }),
    ];

    expect(sellableQuantity(batches, 11, NOW)).toBe(2);
    expect(allocateFefo({ batches, productQuantity: 11, quantity: 3, now: NOW }).ok).toBe(false);
  });
});

describe("FEFO allocation", () => {
  it("allocates from the earliest batch first and does not touch later batches", () => {
    const batches = [
      batch({ _id: "soon", expiryDate: NOW + 20 * DAY, availableQuantity: 10 }),
      batch({ _id: "later", expiryDate: NOW + 200 * DAY, availableQuantity: 10 }),
    ];

    const plan = allocateFefo({ batches, productQuantity: 20, quantity: 4, now: NOW });

    expect(plan.ok).toBe(true);
    expect(plan.units).toEqual([
      {
        batchId: "soon",
        batchNumber: null,
        expiryDate: NOW + 20 * DAY,
        quantity: 4,
      },
    ]);
  });

  it("splits one quantity across two batches when the first runs out", () => {
    const batches = [
      batch({
        _id: "soon",
        batchNumber: "B-1",
        expiryDate: NOW + 20 * DAY,
        availableQuantity: 3,
      }),
      batch({
        _id: "later",
        batchNumber: "B-2",
        expiryDate: NOW + 200 * DAY,
        availableQuantity: 10,
      }),
    ];

    const plan = allocateFefo({ batches, productQuantity: 13, quantity: 8, now: NOW });

    expect(plan.ok).toBe(true);
    expect(plan.units).toEqual([
      {
        batchId: "soon",
        batchNumber: "B-1",
        expiryDate: NOW + 20 * DAY,
        quantity: 3,
      },
      {
        batchId: "later",
        batchNumber: "B-2",
        expiryDate: NOW + 200 * DAY,
        quantity: 5,
      },
    ]);
    expect(plan.allocated).toBe(8);
  });

  it("skips an expired batch and takes the newer one", () => {
    const batches = [
      batch({ _id: "expired", expiryDate: NOW - 5 * DAY, availableQuantity: 20 }),
      batch({ _id: "valid", expiryDate: NOW + 100 * DAY, availableQuantity: 6 }),
    ];

    const plan = allocateFefo({ batches, productQuantity: 26, quantity: 5, now: NOW });

    expect(plan.ok).toBe(true);
    expect(plan.units).toEqual([
      {
        batchId: "valid",
        batchNumber: null,
        expiryDate: NOW + 100 * DAY,
        quantity: 5,
      },
    ]);
  });

  it("fails instead of selling expired stock when only expired units remain", () => {
    const batches = [
      batch({ _id: "expired", expiryDate: NOW - DAY, availableQuantity: 100 }),
    ];

    const plan = allocateFefo({ batches, productQuantity: 100, quantity: 1, now: NOW });

    expect(plan.ok).toBe(false);
    expect(plan.units).toEqual([]);
    expect(plan.sellable).toBe(0);
  });

  it("is all-or-nothing when the batches cannot cover the request", () => {
    const batches = [
      batch({ _id: "a", expiryDate: NOW + 10 * DAY, availableQuantity: 2 }),
      batch({ _id: "b", expiryDate: NOW + 20 * DAY, availableQuantity: 2 }),
    ];

    const plan = allocateFefo({ batches, productQuantity: 4, quantity: 5, now: NOW });

    expect(plan.ok).toBe(false);
    expect(plan.units).toEqual([]);
    expect(plan.sellable).toBe(4);
  });

  it("uses un-batched legacy stock last instead of inventing a batch", () => {
    const batches = [
      batch({ _id: "a", expiryDate: NOW + 10 * DAY, availableQuantity: 2 }),
    ];

    expect(unbatchedQuantity(batches, 7)).toBe(5);

    const plan = allocateFefo({ batches, productQuantity: 7, quantity: 5, now: NOW });

    expect(plan.ok).toBe(true);
    expect(plan.units).toEqual([
      {
        batchId: "a",
        batchNumber: null,
        expiryDate: NOW + 10 * DAY,
        quantity: 2,
      },
      { batchId: null, batchNumber: null, expiryDate: null, quantity: 3 },
    ]);
  });

  it("never allocates more than the product's total stock", () => {
    const batches = [
      batch({ _id: "a", expiryDate: NOW + 10 * DAY, availableQuantity: 5 }),
    ];

    // Product total says 3 even though the batch claims 5.
    const plan = allocateFefo({ batches, productQuantity: 3, quantity: 3, now: NOW });

    expect(plan.ok).toBe(true);
    expect(plan.units).toEqual([
      {
        batchId: "a",
        batchNumber: null,
        expiryDate: NOW + 10 * DAY,
        quantity: 3,
      },
    ]);
  });

  it("rejects non-positive quantities without allocating anything", () => {
    const batches = [
      batch({ _id: "a", expiryDate: NOW + 10 * DAY, availableQuantity: 5 }),
    ];

    expect(allocateFefo({ batches, productQuantity: 5, quantity: 0, now: NOW }).ok).toBe(false);
    expect(allocateFefo({ batches, productQuantity: 5, quantity: -2, now: NOW }).ok).toBe(false);
  });
});
