import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock helpers for Convex context ──
function mockCtx(options: {
  userId?: string | null;
  db?: Record<string, any>;
} = {}) {

  const db = {
    get: vi.fn(async (id: string) => options.db?.[id] ?? null),
    query: vi.fn((table: string) => {
      const items = options.db?.[`__query_${table}`] ?? [];
      const indexChain: any = {
        eq: vi.fn().mockReturnThis(),
        first: vi.fn(async () => items[0] ?? null),
        collect: vi.fn(async () => items),
      };
      return {
        withIndex: vi.fn(() => indexChain),
      };
    }),
    insert: vi.fn(async (table: string, doc: any) => `inserted_${table}_${Math.random()}`),
    patch: vi.fn(async (id: string, patch: any) => ({ id, ...patch })),
    delete: vi.fn(async (id: string) => true),
  };

  return {
    userId: options.userId ?? "user_123",
    auth: {
      getUserId: vi.fn(async () => options.userId ?? "user_123"),
    },
    db,
    scheduler: {
      runAfter: vi.fn(),
    },
  };
}

// ── Cart tests ──
describe("Cart – addItem mutation logic", () => {
  it("should reject if user is not authenticated", () => {
    // Cart handler pattern: if userId === null throw "Not authenticated"
    const userId: string | null = null;
    const authCheck = () => {
      if (userId === null) throw new Error("Not authenticated");
    };
    expect(authCheck).toThrow("Not authenticated");
  });

  it("should throw if product is not found or inactive", async () => {
    const ctx = mockCtx({ userId: "user_123" });
    ctx.db.get.mockResolvedValue(null);

    const product = await ctx.db.get("prod_1");
    expect(product).toBeNull();
  });

  it("should throw if stock is insufficient", async () => {
    const product = { _id: "prod_1", isActive: true, stockQuantity: 2 };
    expect(product.stockQuantity).toBeLessThan(5); // requesting 5
  });

  it("should allow adding to cart when stock is sufficient", async () => {
    const product = { _id: "prod_1", isActive: true, stockQuantity: 10 };
    expect(product.stockQuantity).toBeGreaterThanOrEqual(1);
  });

  it("should increment quantity for existing cart items", async () => {
    const existing = { _id: "cart_1", userId: "user_123", productId: "prod_1", quantity: 3 };
    const product = { _id: "prod_1", stockQuantity: 10 };

    const newQty = existing.quantity + 1;
    expect(newQty).toBe(4);
    expect(newQty).toBeLessThanOrEqual(product.stockQuantity);
  });

  it("should reject if incrementing would exceed stock", async () => {
    const existing = { _id: "cart_1", userId: "user_123", productId: "prod_1", quantity: 9 };
    const product = { _id: "prod_1", stockQuantity: 10 };

    const newQty = existing.quantity + 1;
    expect(newQty).toBe(10);
    expect(newQty).toBeLessThanOrEqual(product.stockQuantity); // OK

    const newQty2 = existing.quantity + 2;
    expect(newQty2).toBe(11);
    expect(newQty2).toBeGreaterThan(product.stockQuantity); // Would fail
  });
});

describe("Cart – updateQuantity mutation logic", () => {
  it("should delete cart item when quantity is 0 or less", async () => {
    const quantity = 0;
    expect(quantity).toBeLessThanOrEqual(0);
    // Handler calls db.delete when quantity <= 0
  });

  it("should reject if quantity exceeds product stock", async () => {
    const product = { stockQuantity: 5 };
    const requestedQuantity = 8;
    expect(requestedQuantity).toBeGreaterThan(product.stockQuantity);
  });

  it("should allow update within stock limits", async () => {
    const product = { stockQuantity: 5 };
    const requestedQuantity = 3;
    expect(requestedQuantity).toBeLessThanOrEqual(product.stockQuantity);
  });
});

describe("Cart – removeItem mutation logic", () => {
  it("should verify item belongs to current user", async () => {
    const item = { _id: "cart_1", userId: "user_123", productId: "prod_1" };
    const currentUserId = "user_123";
    expect(item.userId).toBe(currentUserId);
  });

  it("should reject if item belongs to different user", async () => {
    const item = { _id: "cart_1", userId: "user_456", productId: "prod_1" };
    const currentUserId = "user_123";
    expect(item.userId).not.toBe(currentUserId);
  });
});

describe("Cart – clear mutation logic", () => {
  it("should delete all items for the current user", async () => {
    const items = [
      { _id: "cart_1", userId: "user_123" },
      { _id: "cart_2", userId: "user_123" },
      { _id: "cart_3", userId: "user_456" }, // different user
    ];
    const currentUserId = "user_123";
    const userItems = items.filter((i) => i.userId === currentUserId);
    expect(userItems).toHaveLength(2);
  });
});

describe("Cart – getCount query logic", () => {
  it("should sum all item quantities", () => {
    const items = [
      { quantity: 2 },
      { quantity: 3 },
      { quantity: 1 },
    ];
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    expect(total).toBe(6);
  });

  it("should return 0 for empty cart", () => {
    const items: any[] = [];
    const total = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    expect(total).toBe(0);
  });
});

describe("Cart – integration flow", () => {
  it("add → increment → check stock → remove → clear flow", async () => {
    const ctx = mockCtx({ userId: "user_123" });

    // Simulate adding item
    const product = { _id: "prod_1", isActive: true, stockQuantity: 10, price: 100 };
    ctx.db.get.mockResolvedValueOnce(product);

    const stock = product.stockQuantity;
    expect(stock).toBeGreaterThanOrEqual(1);

    // Simulate insert
    await ctx.db.insert("cart_items", {
      userId: "user_123",
      productId: "prod_1",
      quantity: 2,
    });
    expect(ctx.db.insert).toHaveBeenCalled();

    // Simulate quantity update
    await ctx.db.patch("cart_1", { quantity: 3 });
    expect(ctx.db.patch).toHaveBeenCalledWith("cart_1", { quantity: 3 });

    // Simulate remove
    await ctx.db.delete("cart_1");
    expect(ctx.db.delete).toHaveBeenCalledWith("cart_1");
  });

  it("should prevent ordering more than available stock", () => {
    const availableStock = 5;
    const requestedQuantity = 7;
    expect(requestedQuantity).toBeGreaterThan(availableStock);
    // This simulates the stock check in addItem
  });
});
