import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  Search,
  X,
  PackageOpen,
  Sparkles,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";

export default function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "";
  const initialBrand = searchParams.get("brand") || "";
  const initialSort = searchParams.get("sort") || "relevance";
  const initialRx = searchParams.get("rx") || "";
  const initialStock = searchParams.get("stock") || "";

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(initialCategory);
  const [selectedBrandSlug, setSelectedBrandSlug] = useState(initialBrand);
  const [sortBy, setSortBy] = useState(initialSort);
  const [prescriptionFilter, setPrescriptionFilter] = useState(initialRx);
  const [stockFilter, setStockFilter] = useState(initialStock);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Look up category/brand IDs from slugs
  const allCategories = useQuery(api.categories.list);
  const allBrands = useQuery(api.publicBrands.list);

  const selectedCategoryId = allCategories?.find((c) => c.slug === selectedCategorySlug)?._id;
  const selectedBrandId = allBrands?.find((b) => b.slug === selectedBrandSlug)?._id;

  // Autocomplete suggestions
  const suggestions = useQuery(
    api.publicProducts.autocomplete,
    autocompleteQuery.length >= 2 ? { query: autocompleteQuery } : "skip"
  );

  // Main search query
  const products = useQuery(api.publicProducts.search, {
    query: searchQuery || "",
    categoryId: selectedCategoryId as any,
    brandId: selectedBrandId as any,
    prescriptionRequired: prescriptionFilter === "rx" ? true : prescriptionFilter === "otc" ? false : undefined,
    inStock: stockFilter === "in_stock" ? true : undefined,
    sortBy: sortBy as any,
  });

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategorySlug) params.set("category", selectedCategorySlug);
    if (selectedBrandSlug) params.set("brand", selectedBrandSlug);
    if (sortBy !== "relevance") params.set("sort", sortBy);
    if (prescriptionFilter) params.set("rx", prescriptionFilter);
    if (stockFilter) params.set("stock", stockFilter);
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCategorySlug, selectedBrandSlug, sortBy, prescriptionFilter, stockFilter, setSearchParams]);

  // Close autocomplete on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowAutocomplete(false);
    setSearchQuery(autocompleteQuery);
    setAutocompleteQuery("");
  };

  const handleAutocompleteSelect = (suggestion: { type: string; name: string; slug: string }) => {
    setShowAutocomplete(false);
    setAutocompleteQuery("");
    if (suggestion.type === "product") {
      navigate(`/products/${suggestion.slug}`);
    } else if (suggestion.type === "category") {
      setSelectedCategorySlug(suggestion.slug);
      setSearchQuery("");
    } else if (suggestion.type === "brand") {
      setSelectedBrandSlug(suggestion.slug);
      setSearchQuery("");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategorySlug("");
    setSelectedBrandSlug("");
    setSortBy("relevance");
    setPrescriptionFilter("");
    setStockFilter("");
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = searchQuery || selectedCategorySlug || selectedBrandSlug || prescriptionFilter || stockFilter;

  const isLoading = products === undefined || allCategories === undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/[0.03] to-transparent border-b border-border/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3" />
                Medicine Catalogue
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : selectedCategorySlug
                  ? allCategories?.find((c) => c.slug === selectedCategorySlug)?.name ?? "Category"
                  : selectedBrandSlug
                  ? allBrands?.find((b) => b.slug === selectedBrandSlug)?.name ?? "Brand"
                  : "All Medicines"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {products ? `${products.length} product(s) found` : "Browse our catalogue of genuine medicines and healthcare products."}
              </p>
            </motion.div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="flex gap-8">
            {/* Desktop sidebar filters */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 space-y-6">
                {/* Search */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">Search</h3>
                  <form onSubmit={handleSearchSubmit}>
                    <div className="relative" ref={autocompleteRef}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search medicines..."
                        value={autocompleteQuery || searchQuery}
                        onChange={(e) => {
                          setAutocompleteQuery(e.target.value);
                          if (!e.target.value) setSearchQuery("");
                          setShowAutocomplete(true);
                        }}
                        onFocus={() => setShowAutocomplete(true)}
                        className="pl-9 h-10 rounded-xl"
                      />
                      {(autocompleteQuery || searchQuery) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg"
                          onClick={() => { setAutocompleteQuery(""); setSearchQuery(""); }}
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                      {/* Autocomplete dropdown */}
                      {showAutocomplete && suggestions && suggestions.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border/60 rounded-xl shadow-lg overflow-hidden">
                          {suggestions.map((s, i) => (
                            <button
                              key={`${s.type}-${s.id}`}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
                              onClick={() => handleAutocompleteSelect(s)}
                            >
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {s.type}
                              </Badge>
                              <span className="truncate">{s.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </form>
                </div>

                {/* Categories */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">Categories</h3>
                  <div className="space-y-0.5">
                    <button
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                        !selectedCategorySlug
                          ? "bg-primary/10 text-primary font-semibold shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() => setSelectedCategorySlug("")}
                    >
                      All Categories
                    </button>
                    {allCategories?.map((cat) => (
                      <button
                        key={cat._id}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center justify-between ${
                          selectedCategorySlug === cat.slug
                            ? "bg-primary/10 text-primary font-semibold shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={() => setSelectedCategorySlug(selectedCategorySlug === cat.slug ? "" : cat.slug)}
                      >
                        <span className="truncate">{cat.name}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">{cat.productCount}</Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brands */}
                {allBrands && allBrands.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-3">Brands</h3>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      <button
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                          !selectedBrandSlug
                            ? "bg-primary/10 text-primary font-semibold shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={() => setSelectedBrandSlug("")}
                      >
                        All Brands
                      </button>
                      {allBrands.map((brand) => (
                        <button
                          key={brand._id}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                            selectedBrandSlug === brand.slug
                              ? "bg-primary/10 text-primary font-semibold shadow-sm"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                          onClick={() => setSelectedBrandSlug(selectedBrandSlug === brand.slug ? "" : brand.slug)}
                        >
                          {brand.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prescription Filter */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">Type</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={prescriptionFilter === ""} onCheckedChange={() => setPrescriptionFilter("")} />
                      All
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={prescriptionFilter === "otc"} onCheckedChange={() => setPrescriptionFilter(prescriptionFilter === "otc" ? "" : "otc")} />
                      OTC (Over the Counter)
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={prescriptionFilter === "rx"} onCheckedChange={() => setPrescriptionFilter(prescriptionFilter === "rx" ? "" : "rx")} />
                      Rx (Prescription Required)
                    </label>
                  </div>
                </div>

                {/* Stock Filter */}
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">Availability</h3>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={stockFilter === "in_stock"} onCheckedChange={() => setStockFilter(stockFilter === "in_stock" ? "" : "in_stock")} />
                    In Stock Only
                  </label>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-sm rounded-xl"
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
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search medicines..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl"
                  />
                </div>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}>
                  <SlidersHorizontal className="size-4" />
                </Button>
              </div>

              {/* Mobile filters panel */}
              {mobileFiltersOpen && (
                <div className="lg:hidden mb-4 p-4 rounded-2xl border border-border/60 bg-card space-y-4">
                  <div>
                    <Label className="text-xs font-bold mb-2 block">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relevance">Relevance</SelectItem>
                        <SelectItem value="price_asc">Price: Low to High</SelectItem>
                        <SelectItem value="price_desc">Price: High to Low</SelectItem>
                        <SelectItem value="discount">Biggest Discount</SelectItem>
                        <SelectItem value="newest">Newest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-bold mb-2 block">Type</Label>
                    <div className="flex gap-2">
                      <Button variant={prescriptionFilter === "" ? "default" : "outline"} size="sm" className="rounded-lg text-xs" onClick={() => setPrescriptionFilter("")}>All</Button>
                      <Button variant={prescriptionFilter === "otc" ? "default" : "outline"} size="sm" className="rounded-lg text-xs" onClick={() => setPrescriptionFilter("otc")}>OTC</Button>
                      <Button variant={prescriptionFilter === "rx" ? "default" : "outline"} size="sm" className="rounded-lg text-xs" onClick={() => setPrescriptionFilter("rx")}>Rx</Button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={stockFilter === "in_stock"} onCheckedChange={() => setStockFilter(stockFilter === "in_stock" ? "" : "in_stock")} />
                    In Stock Only
                  </label>
                </div>
              )}

              {/* Sort (desktop) */}
              <div className="hidden lg:flex items-center justify-between mb-4">
                <div className="flex flex-wrap gap-2">
                  {hasActiveFilters && (
                    <>
                      {searchQuery && (
                        <Badge variant="secondary" className="gap-1 text-xs rounded-lg">
                          Search: {searchQuery}
                          <Button variant="ghost" size="icon" className="h-4 w-4 p-0 ml-1" onClick={() => { setSearchQuery(""); setAutocompleteQuery(""); }}>
                            <X className="size-2.5" />
                          </Button>
                        </Badge>
                      )}
                      {selectedCategorySlug && (
                        <Badge variant="secondary" className="gap-1 text-xs rounded-lg">
                          {allCategories?.find((c) => c.slug === selectedCategorySlug)?.name}
                          <Button variant="ghost" size="icon" className="h-4 w-4 p-0 ml-1" onClick={() => setSelectedCategorySlug("")}>
                            <X className="size-2.5" />
                          </Button>
                        </Badge>
                      )}
                      {selectedBrandSlug && (
                        <Badge variant="secondary" className="gap-1 text-xs rounded-lg">
                          {allBrands?.find((b) => b.slug === selectedBrandSlug)?.name}
                          <Button variant="ghost" size="icon" className="h-4 w-4 p-0 ml-1" onClick={() => setSelectedBrandSlug("")}>
                            <X className="size-2.5" />
                          </Button>
                        </Badge>
                      )}
                      {prescriptionFilter && (
                        <Badge variant="secondary" className="gap-1 text-xs rounded-lg">
                          {prescriptionFilter === "rx" ? "Rx Required" : "OTC Only"}
                          <Button variant="ghost" size="icon" className="h-4 w-4 p-0 ml-1" onClick={() => setPrescriptionFilter("")}>
                            <X className="size-2.5" />
                          </Button>
                        </Badge>
                      )}
                      {stockFilter && (
                        <Badge variant="secondary" className="gap-1 text-xs rounded-lg">
                          In Stock Only
                          <Button variant="ghost" size="icon" className="h-4 w-4 p-0 ml-1" onClick={() => setStockFilter("")}>
                            <X className="size-2.5" />
                          </Button>
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[200px] rounded-xl h-9 text-xs">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="discount">Biggest Discount</SelectItem>
                    <SelectItem value="newest">Newest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Products grid */}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : !products || products.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <PackageOpen className="size-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">No products found</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground max-w-sm leading-relaxed">
                    {searchQuery
                      ? `No results for "${searchQuery}". Try a different search term or clear filters.`
                      : "No products match your current filters. Try adjusting your selection."}
                  </p>
                  <Button variant="outline" className="mt-4 text-sm rounded-xl" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                </motion.div>
              ) : (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product as any} />
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
