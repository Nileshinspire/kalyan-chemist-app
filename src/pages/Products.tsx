import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export default function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "";

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(initialCategory);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const categories = useQuery(api.categories.list);
  const allProducts = useQuery(api.products.list, {});

  // Find the category ID from the slug
  const selectedCategoryId = useMemo(() => {
    if (!selectedCategorySlug || !categories) return undefined;
    const cat = categories.find((c) => c.slug === selectedCategorySlug);
    return cat?._id;
  }, [selectedCategorySlug, categories]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    let products = allProducts.filter((p) => p.isActive);

    // Category filter
    if (selectedCategoryId) {
      products = products.filter((p) => p.categoryId === selectedCategoryId);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.manufacturer.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    return products;
  }, [allProducts, selectedCategoryId, searchQuery]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategorySlug) params.set("category", selectedCategorySlug);
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCategorySlug, setSearchParams]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategorySlug("");
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = searchQuery || selectedCategorySlug;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {selectedCategoryId && categories
                ? categories.find((c) => c._id === selectedCategoryId)?.name || "Medicines"
                : searchQuery
                ? `Results for "${searchQuery}"`
                : "All Medicines"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} available
            </p>
          </div>

          <div className="flex gap-8">
            {/* Desktop sidebar filters */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 space-y-6">
                {/* Search */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Search
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Categories
                  </h3>
                  <div className="space-y-1">
                    <button
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        !selectedCategorySlug
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() => setSelectedCategorySlug("")}
                    >
                      All Categories
                    </button>
                    {categories?.map((cat) => (
                      <button
                        key={cat._id}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedCategorySlug === cat.slug
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={() => setSelectedCategorySlug(cat.slug)}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-sm"
                    onClick={clearFilters}
                  >
                    <X className="mr-1.5 size-3" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Mobile filter bar */}
              <div className="flex items-center gap-3 mb-4 lg:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm gap-1.5"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                >
                  <SlidersHorizontal className="size-3.5" />
                  Filters
                  <ChevronDown className={`size-3 transition-transform ${showMobileFilters ? "rotate-180" : ""}`} />
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>

              {/* Mobile filter panel */}
              {showMobileFilters && (
                <div className="lg:hidden mb-6 p-4 rounded-xl border border-border/60 bg-card space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search medicines…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant={!selectedCategorySlug ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => setSelectedCategorySlug("")}
                    >
                      All
                    </Badge>
                    {categories?.map((cat) => (
                      <Badge
                        key={cat._id}
                        variant={
                          selectedCategorySlug === cat.slug ? "default" : "outline"
                        }
                        className="cursor-pointer text-xs"
                        onClick={() => setSelectedCategorySlug(cat.slug)}
                      >
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Active filter chips */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Search: {searchQuery}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="size-2.5" />
                      </Button>
                    </Badge>
                  )}
                  {selectedCategorySlug && categories && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      {
                        categories.find((c) => c.slug === selectedCategorySlug)
                          ?.name
                      }
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => setSelectedCategorySlug("")}
                      >
                        <X className="size-2.5" />
                      </Button>
                    </Badge>
                  )}
                </div>
              )}

              {/* Product grid */}
              {allProducts === undefined ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-40 w-full rounded-xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="size-7 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    No products found
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                    We could not find any medicines matching your search. Try
                    adjusting your filters or search terms.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 text-sm"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
