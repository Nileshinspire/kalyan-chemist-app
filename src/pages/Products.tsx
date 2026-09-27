import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getPaginationRange } from "@/lib/pagination";
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

/**
 * Extract URL search-param values OUTSIDE the component so they are stable
 * across renders. This avoids the bidirectional URL ↔ state sync loop that
 * caused visible page blinking on every category navigation.
 */
function useUrlFilterValues() {
  const [searchParams] = useSearchParams();
  const urlSearch = useMemo(() => searchParams.get("search") || "", [searchParams.get("search")]);
  const urlCategory = useMemo(() => searchParams.get("category") || "", [searchParams.get("category")]);
  const urlBrand = useMemo(() => searchParams.get("brand") || "", [searchParams.get("brand")]);
  const urlSort = useMemo(() => searchParams.get("sort") || "relevance", [searchParams.get("sort")]);
  const urlRx = useMemo(() => searchParams.get("rx") || "", [searchParams.get("rx")]);
  const urlStock = useMemo(() => searchParams.get("stock") || "", [searchParams.get("stock")]);
  const urlPage = useMemo(() => {
    const parsed = parseInt(searchParams.get("page") || "1", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [searchParams]);
  const navKey = useMemo(() => searchParams.get("nav") || "", [searchParams.get("nav")]);
  return { urlSearch, urlCategory, urlBrand, urlSort, urlRx, urlStock, urlPage, navKey };
}

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params into stable memoized values (no extra renders)
  const { urlSearch, urlCategory, urlBrand, urlSort, urlRx, urlStock, urlPage, navKey } = useUrlFilterValues();

  // Local state — initialized from URL, updated by user interactions.
  // The raw setters below are only used by the URL → state sync effect;
  // user interactions go through the page-resetting wrappers.
  const [searchQuery, setSearchQueryState] = useState(urlSearch);
  const [selectedCategorySlug, setSelectedCategorySlugState] = useState(urlCategory);
  const [selectedBrandSlug, setSelectedBrandSlugState] = useState(urlBrand);
  const [sortBy, setSortByState] = useState(urlSort);
  const [prescriptionFilter, setPrescriptionFilterState] = useState(urlRx);
  const [stockFilter, setStockFilterState] = useState(urlStock);

  // Current 1-based results page — derived straight from the `page` URL param
  // so refresh / share / back-forward all restore the same page, and every
  // URL write (paging, filter helpers, navbar links) stays authoritative.
  const page = urlPage;

  // Any change to search / category / brand / sorting redefines the result
  // set, so pagination always restarts at page 1 (total pages are then
  // recalculated from the paginated query).
  const resetPage = () => {
    if (searchParams.has("page")) {
      const next = new URLSearchParams(searchParams);
      next.delete("page");
      setSearchParams(next, { replace: true });
    }
  };
  const setSearchQuery = (value: string) => { setSearchQueryState(value); resetPage(); };
  const setSelectedCategorySlug = (value: string) => { setSelectedCategorySlugState(value); resetPage(); };
  const setSelectedBrandSlug = (value: string) => { setSelectedBrandSlugState(value); resetPage(); };
  const setSortBy = (value: string) => { setSortByState(value); resetPage(); };
  const setPrescriptionFilter = (value: string) => { setPrescriptionFilterState(value); resetPage(); };
  const setStockFilter = (value: string) => { setStockFilterState(value); resetPage(); };

  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Sync URL → local state on external navigation (e.g. Navbar category click)
  // Only runs when individual param values actually change — not on every render
  useEffect(() => {
    setSearchQueryState(urlSearch);
    setSelectedCategorySlugState(urlCategory);
    setSelectedBrandSlugState(urlBrand);
    setSortByState(urlSort);
    setPrescriptionFilterState(urlRx);
    setStockFilterState(urlStock);
  }, [urlSearch, urlCategory, urlBrand, urlSort, urlRx, urlStock]);

  // Look up category/brand IDs from slugs
  const allCategories = useQuery(api.categories.list);
  const allBrands = useQuery(api.publicBrands.list);

  // Local interaction helpers — writes to URL via setSearchParams so the
  // sidebar categories stay in sync without bidirectional sync effects.
  const setSelectedCat = (slug: string) => {
    const p = new URLSearchParams();
    if (slug) p.set('category', slug);
    if (searchQuery) p.set('search', searchQuery);
    if (selectedBrandSlug) p.set('brand', selectedBrandSlug);
    if (sortBy !== 'relevance') p.set('sort', sortBy);
    if (prescriptionFilter) p.set('rx', prescriptionFilter);
    if (stockFilter) p.set('stock', stockFilter);
    setSearchParams(p, { replace: true });
  };
  const setSelectedBrand = (slug: string) => {
    const p = new URLSearchParams();
    if (selectedCategorySlug) p.set('category', selectedCategorySlug);
    if (slug) p.set('brand', slug);
    if (searchQuery) p.set('search', searchQuery);
    if (sortBy !== 'relevance') p.set('sort', sortBy);
    if (prescriptionFilter) p.set('rx', prescriptionFilter);
    if (stockFilter) p.set('stock', stockFilter);
    setSearchParams(p, { replace: true });
  };

  const selectedCategoryId = allCategories?.find((c) => c.slug === selectedCategorySlug)?._id;
  const selectedBrandId = allBrands?.find((b) => b.slug === selectedBrandSlug)?._id;

  // Autocomplete suggestions
  const suggestions = useQuery(
    api.publicProducts.autocomplete,
    autocompleteQuery.length >= 2 ? { query: autocompleteQuery } : "skip"
  );

  // Slug filters must be resolved to ids before searching. Wait for those
  // lookups only when a slug is actually in play, so we never fire a wasted
  // request with no filter and then re-query once the tables arrive.
  const filtersReady =
    (!selectedCategorySlug || allCategories !== undefined) &&
    (!selectedBrandSlug || allBrands !== undefined);

  // Responsive page size: 8 products on the mobile 2-column grid, 12 on the
  // 3/4-column tablet & desktop grids — one dataset, just a smaller slice
  // per viewport (no separate product data).
  const [isMobileViewport, setIsMobileViewport] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleViewportChange = (event: MediaQueryListEvent) =>
      setIsMobileViewport(event.matches);
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);
  const pageSize = isMobileViewport ? 8 : 12;

  // Shared filter args for the listing. Pagination happens at the data level:
  // one subscription fetches only the current page of products, and a second
  // page-independent subscription fetches just the total for page counts — so
  // the browser never receives (or hides) the whole catalogue, and the page
  // numbers stay steady while a new page loads.
  const baseArgs = filtersReady
    ? {
        query: searchQuery || "",
        categoryId: selectedCategoryId as any,
        brandId: selectedBrandId as any,
        prescriptionRequired: prescriptionFilter === "rx" ? true : prescriptionFilter === "otc" ? false : undefined,
        inStock: stockFilter === "in_stock" ? true : undefined,
        sortBy: sortBy as any,
      }
    : "skip";

  const counts = useQuery(
    api.publicProducts.searchPage,
    baseArgs === "skip" ? "skip" : { ...baseArgs, offset: 0, limit: 1 }
  );

  const totalProducts = counts?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  // Clamp pages that no longer exist (shrunken result set, viewport change,
  // hand-edited URL). While totals are still unknown we trust the requested
  // page so a deep link (?page=5) doesn't briefly fetch page 1 instead.
  const currentPage =
    counts === undefined ? Math.max(1, page) : Math.min(Math.max(1, page), totalPages);

  // Main products query — only the current page's slice is returned.
  const results = useQuery(
    api.publicProducts.searchPage,
    baseArgs === "skip"
      ? "skip"
      : {
          ...baseArgs,
          offset: Math.max(0, (currentPage - 1) * pageSize),
          limit: pageSize,
        }
  );

  const products = results?.items;
  // An out-of-range page renders the loader (not "no products found") while
  // the clamped page number refetches.
  const pageOutOfRange = results !== undefined && counts !== undefined && page !== currentPage;

  const resultsRef = useRef<HTMLDivElement>(null);

  const goToPage = (nextPage: number) => {
    const target = Math.min(Math.max(1, nextPage), totalPages);
    if (target === page) return;
    // `page` is derived from the URL, so the push below IS the state update.
    const params = new URLSearchParams(searchParams);
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    // Push (not replace) so browser back/forward walks the pages too.
    setSearchParams(params);
    // Return smoothly to the top of the results instead of leaving the user
    // at the bottom of the previous page's cards.
    const resultsTop = resultsRef.current;
    if (resultsTop) {
      const top = resultsTop.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  };



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
      navigate(`/products/${suggestion.slug}`, { state: { from: location.pathname + location.search } });
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
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters = searchQuery || selectedCategorySlug || selectedBrandSlug || prescriptionFilter || stockFilter;

  // The grid depends only on the product results — filter metadata (categories
  // / brands) loads in parallel and no longer blocks the listing.
  const isLoading = results === undefined;

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
                {counts ? `${totalProducts} product(s) found` : "Browse our catalogue of genuine medicines and healthcare products."}
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
                  <div className="space-y-0.5">                      <button
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                          !selectedCategorySlug
                            ? "bg-primary/10 text-primary font-semibold shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={() => setSelectedCat("")}
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
                        onClick={() => setSelectedCat(selectedCategorySlug === cat.slug ? "" : cat.slug)}
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
                        onClick={() => setSelectedBrand("")}
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
                          onClick={() => setSelectedBrand(selectedBrandSlug === brand.slug ? "" : brand.slug)}
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
            <div className="flex-1 min-w-0" ref={resultsRef}>
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

              {/* Scoped compact-card styles: shrink ONLY the product cards
                  rendered inside this listing grid (smaller image band,
                  tighter padding/spacing/typography, compact action buttons).
                  The sidebar, filters and every other product section stay
                  untouched. */}
              <style>{`
                .kc-products-grid .h-44 { height: 6.5rem; }
                .kc-products-grid .size-20 { width: 4.5rem; height: 4.5rem; }
                .kc-products-grid .size-14 { width: 2.75rem; height: 2.75rem; }
                .kc-products-grid .p-4 { padding: 0.625rem 0.75rem; }
                .kc-products-grid .space-y-2\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.375rem; }
                .kc-products-grid .text-sm { font-size: 0.8125rem; line-height: 1.25rem; }
                .kc-products-grid .text-xs { font-size: 0.6875rem; line-height: 1rem; }
                .kc-products-grid button.text-xs { font-size: 0.75rem; line-height: 1rem; }
                .kc-products-grid .text-lg { font-size: 1rem; line-height: 1.5rem; }
                .kc-products-grid .h-9 { height: 1.875rem; }
                .kc-products-grid .h-8 { height: 1.75rem; }
                .kc-products-grid .w-8 { width: 1.75rem; }
              `}</style>

              {/* Products grid */}
              {isLoading || pageOutOfRange ? (
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
                <div className="kc-products-grid grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product._id} product={product as any} />
                  ))}
                </div>
              )}

              {/* Numbered pagination — replaces endless scrolling. Clicking a
                  page swaps the slice returned by the query (no full reload),
                  recalculates total pages and scrolls back to the results. */}
              {!pageOutOfRange && totalPages > 1 && (
                <Pagination className="mt-6">
                  <PaginationContent className="flex-wrap justify-center">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={currentPage <= 1}
                        onClick={(event) => {
                          event.preventDefault();
                          if (currentPage > 1) goToPage(currentPage - 1);
                        }}
                        className={currentPage <= 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {getPaginationRange(currentPage, totalPages).map((item, index) =>
                      item === "ellipsis" ? (
                        <PaginationItem key={`pagination-ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item}>
                          <PaginationLink
                            href="#"
                            isActive={item === currentPage}
                            onClick={(event) => {
                              event.preventDefault();
                              goToPage(item);
                            }}
                            className={
                              item === currentPage
                                ? "cursor-pointer border-primary/40 bg-primary/10 font-semibold text-primary shadow-sm"
                                : "cursor-pointer"
                            }
                          >
                            {item}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={currentPage >= totalPages}
                        onClick={(event) => {
                          event.preventDefault();
                          if (currentPage < totalPages) goToPage(currentPage + 1);
                        }}
                        className={currentPage >= totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
