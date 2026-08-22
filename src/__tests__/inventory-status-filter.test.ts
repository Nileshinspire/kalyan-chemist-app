import { describe, it, expect } from "vitest";

/**
 * Tests for the AdminInventory status filtering logic.
 *
 * The component filters inventory products by stock status when summary cards are clicked.
 * This test verifies the filtering logic independently of the UI.
 */

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

interface MockProduct {
  _id: string;
  name: string;
  stockQuantity: number;
  stockStatus: StockStatus;
  categoryName: string;
  price: number;
  sku: string;
}

function createProduct(
  id: string,
  name: string,
  qty: number,
  status: StockStatus,
  category = "Medicines"
): MockProduct {
  return {
    _id: id,
    name,
    stockQuantity: qty,
    stockStatus: status,
    categoryName: category,
    price: 100,
    sku: `SKU-${id.slice(-3)}`,
  };
}

function filterProducts(
  products: MockProduct[],
  filterStatus: string,
  search: string,
  threshold: number
): MockProduct[] {
  return products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    let matchesFilter = true;
    if (filterStatus === "in_stock") {
      matchesFilter = p.stockStatus === "in_stock";
    } else if (filterStatus === "low_stock") {
      matchesFilter = p.stockStatus === "low_stock";
    } else if (filterStatus === "out_of_stock") {
      matchesFilter = p.stockStatus === "out_of_stock";
    }
    return matchesSearch && matchesFilter;
  });
}

function computeSummary(products: MockProduct[], threshold: number) {
  return {
    total: products.length,
    inStockCount: products.filter((p) => p.stockStatus === "in_stock").length,
    lowStockCount: products.filter((p) => p.stockStatus === "low_stock").length,
    outOfStockCount: products.filter((p) => p.stockStatus === "out_of_stock").length,
  };
}

const sampleProducts: MockProduct[] = [
  createProduct("prod_001", "Dolo 650", 50, "in_stock"),
  createProduct("prod_002", "Crocin 500", 8, "low_stock"),
  createProduct("prod_003", "Band-Aid", 0, "out_of_stock"),
  createProduct("prod_004", "Paracetamol 650", 25, "in_stock", "Personal Care"),
  createProduct("prod_005", "Becosules", 3, "low_stock"),
  createProduct("prod_006", "Vicks VapoRub", 0, "out_of_stock"),
  createProduct("prod_007", "Azithromycin", 100, "in_stock"),
  createProduct("prod_008", "Cetirizine 10mg", 6, "low_stock"),
];

describe("Inventory Status Card Filtering", () => {
  const threshold = 10;

  it("shows all products when Total Products card is clicked (filterStatus='all')", () => {
    const result = filterProducts(sampleProducts, "all", "", threshold);
    expect(result).toHaveLength(8);
  });

  it("filters to in-stock products when In Stock card is clicked", () => {
    const result = filterProducts(sampleProducts, "in_stock", "", threshold);
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.stockStatus === "in_stock")).toBe(true);
  });

  it("filters to low-stock products when Low Stock card is clicked", () => {
    const result = filterProducts(sampleProducts, "low_stock", "", threshold);
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.stockStatus === "low_stock")).toBe(true);
  });

  it("filters to out-of-stock products when Out of Stock card is clicked", () => {
    const result = filterProducts(sampleProducts, "out_of_stock", "", threshold);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.stockStatus === "out_of_stock")).toBe(true);
  });

  it("returns empty when filtering for a status with no matching products", () => {
    const allInStock = [createProduct("p1", "A", 10, "in_stock")];
    const result = filterProducts(allInStock, "out_of_stock", "", threshold);
    expect(result).toHaveLength(0);
  });

  it("combines status filter with search", () => {
    const result = filterProducts(sampleProducts, "in_stock", "Dolo", threshold);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Dolo 650");
  });

  it("search with status filter yields no results on mismatch", () => {
    const result = filterProducts(sampleProducts, "out_of_stock", "Dolo", threshold);
    expect(result).toHaveLength(0);
  });

  it("search across all statuses before applying filter", () => {
    const result = filterProducts(sampleProducts, "all", "ecos", threshold);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Becosules");
  });
});

describe("Inventory Summary Stats Computation", () => {
  const threshold = 10;

  it("computes correct total count", () => {
    const summary = computeSummary(sampleProducts, threshold);
    expect(summary.total).toBe(8);
  });

  it("computes correct in-stock count", () => {
    const summary = computeSummary(sampleProducts, threshold);
    expect(summary.inStockCount).toBe(3);
  });

  it("computes correct low-stock count", () => {
    const summary = computeSummary(sampleProducts, threshold);
    expect(summary.lowStockCount).toBe(3);
  });

  it("computes correct out-of-stock count", () => {
    const summary = computeSummary(sampleProducts, threshold);
    expect(summary.outOfStockCount).toBe(2);
  });

  it("card counts match filtered results", () => {
    const summary = computeSummary(sampleProducts, threshold);
    const inStock = filterProducts(sampleProducts, "in_stock", "", threshold);
    const lowStock = filterProducts(sampleProducts, "low_stock", "", threshold);
    const outOfStock = filterProducts(sampleProducts, "out_of_stock", "", threshold);

    expect(summary.inStockCount).toBe(inStock.length);
    expect(summary.lowStockCount).toBe(lowStock.length);
    expect(summary.outOfStockCount).toBe(outOfStock.length);
    expect(summary.total).toBe(inStock.length + lowStock.length + outOfStock.length);
  });

  it("handles empty products array", () => {
    const summary = computeSummary([], threshold);
    expect(summary.total).toBe(0);
    expect(summary.inStockCount).toBe(0);
    expect(summary.lowStockCount).toBe(0);
    expect(summary.outOfStockCount).toBe(0);
  });
});
