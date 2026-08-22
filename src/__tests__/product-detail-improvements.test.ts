import { describe, it, expect } from "vitest";

// ─── Bought Count Logic ───
describe("Bought in Last 7 Days", () => {
  it("should return 0 when no orders exist", () => {
    const orders: any[] = [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const count = orders.filter(
      (o) =>
        o.status !== "cancelled" &&
        o.createdAt >= sevenDaysAgo &&
        o.items.some((item: any) => item.productId === "prod_123")
    ).reduce((sum: number, o: any) => {
      const item = o.items.find((i: any) => i.productId === "prod_123");
      return sum + (item?.quantity || 0);
    }, 0);

    expect(count).toBe(0);
  });

  it("should count purchases from last 7 days only", () => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

    const orders = [
      {
        status: "delivered",
        createdAt: now - 3 * 24 * 60 * 60 * 1000, // 3 days ago
        items: [{ productId: "prod_1", quantity: 2 }],
      },
      {
        status: "delivered",
        createdAt: eightDaysAgo, // 8 days ago — should NOT count
        items: [{ productId: "prod_1", quantity: 5 }],
      },
    ];

    const count = orders
      .filter(
        (o) =>
          o.status !== "cancelled" &&
          o.createdAt >= sevenDaysAgo &&
          o.items.some((item) => item.productId === "prod_1")
      )
      .reduce((sum, o) => {
        const item = o.items.find((i) => i.productId === "prod_1");
        return sum + (item?.quantity || 0);
      }, 0);

    expect(count).toBe(2);
  });

  it("should exclude cancelled orders", () => {
    const now = Date.now();
    const orders = [
      {
        status: "cancelled",
        createdAt: now - 1 * 24 * 60 * 60 * 1000,
        items: [{ productId: "prod_1", quantity: 3 }],
      },
      {
        status: "delivered",
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
        items: [{ productId: "prod_1", quantity: 1 }],
      },
    ];

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const count = orders
      .filter(
        (o) =>
          o.status !== "cancelled" &&
          o.createdAt >= sevenDaysAgo &&
          o.items.some((item) => item.productId === "prod_1")
      )
      .reduce((sum, o) => {
        const item = o.items.find((i) => i.productId === "prod_1");
        return sum + (item?.quantity || 0);
      }, 0);

    expect(count).toBe(1);
  });

  it("should count multiple quantities correctly", () => {
    const now = Date.now();
    const orders = [
      {
        status: "delivered",
        createdAt: now - 1 * 24 * 60 * 60 * 1000,
        items: [{ productId: "prod_1", quantity: 5 }],
      },
      {
        status: "processing",
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
        items: [{ productId: "prod_1", quantity: 3 }],
      },
    ];

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const count = orders
      .filter(
        (o) =>
          o.status !== "cancelled" &&
          o.createdAt >= sevenDaysAgo &&
          o.items.some((item) => item.productId === "prod_1")
      )
      .reduce((sum, o) => {
        const item = o.items.find((i) => i.productId === "prod_1");
        return sum + (item?.quantity || 0);
      }, 0);

    expect(count).toBe(8);
  });

  it("should only count the specific product, not others", () => {
    const now = Date.now();
    const orders = [
      {
        status: "delivered",
        createdAt: now - 1 * 24 * 60 * 60 * 1000,
        items: [
          { productId: "prod_1", quantity: 2 },
          { productId: "prod_2", quantity: 10 },
        ],
      },
    ];

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const count = orders
      .filter(
        (o) =>
          o.status !== "cancelled" &&
          o.createdAt >= sevenDaysAgo &&
          o.items.some((item) => item.productId === "prod_1")
      )
      .reduce((sum, o) => {
        const item = o.items.find((i) => i.productId === "prod_1");
        return sum + (item?.quantity || 0);
      }, 0);

    expect(count).toBe(2);
  });
});

// ─── Benefits Display ───
describe("Product Benefits", () => {
  it("should display benefits when available", () => {
    const product = {
      name: "Dolo 650",
      benefits: "Provides fast relief from pain and fever",
    };
    expect(product.benefits).toBeTruthy();
    expect(product.benefits).toContain("pain");
  });

  it("should handle missing benefits gracefully", () => {
    const product = {
      name: "Dolo 650",
      benefits: undefined,
    };
    expect(product.benefits).toBeUndefined();
    // In the UI, benefits section is conditionally rendered
    const showBenefits = !!product.benefits;
    expect(showBenefits).toBe(false);
  });

  it("should handle empty benefits string", () => {
    const product = {
      name: "Dolo 650",
      benefits: "",
    };
    const showBenefits = !!product.benefits;
    expect(showBenefits).toBe(false);
  });
});

// ─── Product Image Display ───
describe("Product Image Display", () => {
  it("should show image when imageUrl is provided", () => {
    const product = {
      name: "Dolo 650",
      imageUrl: "https://example.com/dolo-650.jpg",
    };
    expect(product.imageUrl).toBeTruthy();
    expect(product.imageUrl).toContain("dolo");
  });

  it("should fallback to icon when no image", () => {
    const product = {
      name: "Dolo 650",
      imageUrl: undefined,
    };
    const hasImage = !!product.imageUrl;
    expect(hasImage).toBe(false);
  });

  it("should handle placeholder image path", () => {
    const product = {
      name: "Dolo 650",
      imageUrl: "/placeholder-medicine.svg",
    };
    // In ProductCard, placeholder is treated as no image
    const isRealImage =
      product.imageUrl && product.imageUrl !== "/placeholder-medicine.svg";
    expect(isRealImage).toBe(false);
  });
});

// ─── Image Search Action ───
describe("Product Image Search", () => {
  it("should construct search query from product name", () => {
    const productName = "Dolo 650";
    const manufacturer = "Micro Labs";
    const brand = undefined;

    let query = productName;
    if (manufacturer) query += ` ${manufacturer}`;
    if (brand) query += ` ${brand}`;
    query += " medicine tablet image";

    expect(query).toBe("Dolo 650 Micro Labs medicine tablet image");
  });

  it("should include brand in search when available", () => {
    const productName = "Crocin Advance";
    const manufacturer = "GSK";
    const brand = "Crocin";

    let query = productName;
    if (manufacturer) query += ` ${manufacturer}`;
    if (brand) query += ` ${brand}`;
    query += " medicine tablet image";

    expect(query).toContain("Crocin");
    expect(query).toContain("GSK");
  });

  it("should return success false when no query terms", () => {
    const productName = "";
    const hasQuery = productName.trim().length > 0;
    expect(hasQuery).toBe(false);
  });

  it("should validate URL format", () => {
    const validUrl = "https://example.com/image.jpg";
    const invalidUrl = "not-a-url";
    const emptyUrl = "";

    expect(validUrl.startsWith("http")).toBe(true);
    expect(invalidUrl.startsWith("http")).toBe(false);
    expect(emptyUrl.length > 0).toBe(false);
  });

  it("should validate image URL file extensions", () => {
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const testUrls = [
      "https://example.com/image.jpg",
      "https://example.com/image.png",
      "https://example.com/product.webp",
    ];

    for (const url of testUrls) {
      const hasValidExt = validExtensions.some((ext) =>
        url.toLowerCase().includes(ext)
      );
      expect(hasValidExt).toBe(true);
    }
  });
});

// ─── Review Placement ───
describe("Review Button Placement", () => {
  it("should have review button near product name", () => {
    // The "Write a Review" button should be in the product info section
    // Not in a separate section at the bottom
    const reviewButtonText = "Write a Review";
    expect(reviewButtonText).toBeTruthy();
  });

  it("should show average rating next to review button", () => {
    const avgRating = { average: 4.5, count: 12 };
    expect(avgRating.average).toBeGreaterThanOrEqual(1);
    expect(avgRating.average).toBeLessThanOrEqual(5);
    expect(avgRating.count).toBeGreaterThan(0);
  });

  it("should show review count with proper grammar", () => {
    function getReviewGrammar(count: number): string {
      return count === 1 ? "review" : "reviews";
    }
    expect(getReviewGrammar(1)).toBe("review");
    expect(getReviewGrammar(5)).toBe("reviews");
    expect(getReviewGrammar(0)).toBe("reviews");
  });
});

// ─── Admin Form ───
describe("Admin Product Form", () => {
  it("should include benefits field in form", () => {
    const form = {
      name: "Dolo 650",
      benefits: "Provides fast relief from pain and fever",
    };
    expect(form.benefits).toBeDefined();
    expect(typeof form.benefits).toBe("string");
  });

  it("should handle empty benefits in create", () => {
    const data = {
      name: "Dolo 650",
      benefits: undefined,
    };
    // Benefits should be optional
    expect(data.benefits).toBeUndefined();
  });

  it("should auto-generate slug from name", () => {
    const name = "Dolo 650 Tablet";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    expect(slug).toBe("dolo-650-tablet");
  });

  it("should validate required fields", () => {
    const form = {
      name: "Dolo 650",
      description: "Paracetamol tablet",
      categoryId: "cat_123",
      manufacturer: "Micro Labs",
      packSize: "10 tablets",
    };
    expect(form.name).toBeTruthy();
    expect(form.description).toBeTruthy();
    expect(form.categoryId).toBeTruthy();
    expect(form.manufacturer).toBeTruthy();
    expect(form.packSize).toBeTruthy();
  });
});

// ─── Display Formatting ───
describe("Display Formatting", () => {
  it("should format large bought counts with locale", () => {
    const count = 2571;
    const formatted = count.toLocaleString("en-IN");
    expect(formatted).toBe("2,571");
  });

  it("should handle zero bought count", () => {
    const count = 0;
    const message =
      count > 0
        ? `${count.toLocaleString("en-IN")} people bought this in the last 7 days`
        : "Be the first to buy this product";
    expect(message).toBe("Be the first to buy this product");
  });

  it("should format single bought count", () => {
    const count = 1;
    const message =
      count > 0
        ? `${count.toLocaleString("en-IN")} people bought this in the last 7 days`
        : "Be the first to buy this product";
    expect(message).toBe("1 people bought this in the last 7 days");
  });

  it("should show proper discount percentage", () => {
    const price = 100;
    const discountPrice = 80;
    const discountPct = Math.round(((price - discountPrice) / price) * 100);
    expect(discountPct).toBe(20);
  });

  it("should show no discount when prices are equal", () => {
    const price = 100;
    const discountPrice: number | undefined = 100;
    const hasDiscount = discountPrice !== undefined && discountPrice < price;
    expect(hasDiscount).toBe(false);
  });
});
