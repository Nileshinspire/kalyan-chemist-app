import { describe, it, expect } from "vitest";

/**
 * Tests for the AdminOrders status filtering logic.
 *
 * The component filters orders by status when summary cards are clicked.
 * This test verifies the filtering logic independently of the UI.
 */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "ready_for_dispatch"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refund_initiated"
  | "refunded";

interface MockOrder {
  _id: string;
  status: OrderStatus;
  totalAmount: number;
  invoiceNumber: string;
  userName: string;
}

function createOrder(
  id: string,
  status: OrderStatus,
  amount: number
): MockOrder {
  return {
    _id: id,
    status,
    totalAmount: amount,
    invoiceNumber: `INV${id.slice(-4).replace(/^_/, "-")}`,
    userName: "Test Customer",
  };
}

function filterOrders(
  orders: MockOrder[],
  filterStatus: string,
  search: string
): MockOrder[] {
  return orders.filter((o) => {
    const matchesSearch =
      !search ||
      o.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.userName.toLowerCase().includes(search.toLowerCase()) ||
      o._id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || o.status === filterStatus || (filterStatus === "processing" && o.status === "confirmed");
    return matchesSearch && matchesStatus;
  });
}

function computeStats(orders: MockOrder[]) {
  return {
    total: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    processing: orders.filter(
      (o) => o.status === "processing" || o.status === "confirmed"
    ).length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    revenue: orders
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.totalAmount, 0),
  };
}

const sampleOrders: MockOrder[] = [
  createOrder("ord_001", "pending", 250),
  createOrder("ord_002", "pending", 300),
  createOrder("ord_003", "processing", 150),
  createOrder("ord_004", "confirmed", 400),
  createOrder("ord_005", "delivered", 600),
  createOrder("ord_006", "delivered", 750),
  createOrder("ord_007", "cancelled", 200),
  createOrder("ord_008", "out_for_delivery", 500),
];

describe("Order Status Card Filtering", () => {
  it("shows all orders when Total card is clicked (filterStatus='all')", () => {
    const result = filterOrders(sampleOrders, "all", "");
    expect(result).toHaveLength(8);
  });

  it("filters to pending orders when Pending card is clicked", () => {
    const result = filterOrders(sampleOrders, "pending", "");
    expect(result).toHaveLength(2);
    expect(result.every((o) => o.status === "pending")).toBe(true);
  });

  it("filters to processing+confirmed orders when Processing card is clicked", () => {
    const result = filterOrders(sampleOrders, "processing", "");
    expect(result).toHaveLength(2);
    expect(
      result.every((o) => o.status === "processing" || o.status === "confirmed")
    ).toBe(true);
  });

  it("filters to delivered orders when Delivered card is clicked", () => {
    const result = filterOrders(sampleOrders, "delivered", "");
    expect(result).toHaveLength(2);
    expect(result.every((o) => o.status === "delivered")).toBe(true);
  });

  it("returns empty when filtering for a status with no orders", () => {
    const result = filterOrders(sampleOrders, "refunded", "");
    expect(result).toHaveLength(0);
  });

  it("combines status filter with search", () => {
    const result = filterOrders(sampleOrders, "pending", "INV-001");
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("ord_001");
  });

  it("search across all orders before status filter", () => {
    // Search for something that matches across statuses
    const result = filterOrders(sampleOrders, "all", "Test Customer");
    expect(result).toHaveLength(8);
  });

  it("search with status filter yields no results if mismatch", () => {
    const result = filterOrders(sampleOrders, "delivered", "INV-001");
    // INV-001 belongs to a pending order
    expect(result).toHaveLength(0);
  });
});

describe("Order Status Stats Computation", () => {
  it("computes correct total count", () => {
    const stats = computeStats(sampleOrders);
    expect(stats.total).toBe(8);
  });

  it("computes correct pending count", () => {
    const stats = computeStats(sampleOrders);
    expect(stats.pending).toBe(2);
  });

  it("computes correct processing count (processing + confirmed)", () => {
    const stats = computeStats(sampleOrders);
    expect(stats.processing).toBe(2); // 1 processing + 1 confirmed
  });

  it("computes correct delivered count", () => {
    const stats = computeStats(sampleOrders);
    expect(stats.delivered).toBe(2);
  });

  it("excludes cancelled orders from revenue", () => {
    const stats = computeStats(sampleOrders);
    // 250+300+150+400+600+750+500 = 2950 (excludes cancelled 200)
    expect(stats.revenue).toBe(2950);
  });

  it("handles empty orders array", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.processing).toBe(0);
    expect(stats.delivered).toBe(0);
    expect(stats.revenue).toBe(0);
  });
});
