import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router";
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

/* ─────────────────────────────────────────────────────────────
   CATEGORY NAV ITEMS
   Each nav item maps to one or more DB category name patterns.
   "all" means no filter (show all products).
   ───────────────────────────────────────────────────────────── */
interface NavCategoryAll {
  label: string;
  key: string;
  filterSlugs: null;
}
interface NavCategoryFiltered {
  label: string;
  key: string;
  filterSlugs: string[];
}
type NavCategory = NavCategoryAll | NavCategoryFiltered;

const NAV_CATEGORIES: NavCategory[] = [
  { label: "Kalyan Chemist Products", key: "all", filterSlugs: null },
  { label: "Baby Care", key: "baby-care", filterSlugs: ["baby-mother"] },
  { label: "Nutritional Drinks & Supplements", key: "nutrition", filterSlugs: ["nutrition"] },
  { label: "Women Care", key: "women-care", filterSlugs: ["baby-mother"] },
  { label: "Personal Care", key: "personal-care", filterSlugs: ["personal-care", "skin-personal-care"] },
  { label: "Ayurveda", key: "ayurveda", filterSlugs: ["alternative-medicine"] },
  { label: "Home Essentials", key: "home-essentials", filterSlugs: ["others"] },
  { label: "Health Conditions", key: "health-conditions", filterSlugs: ["health-safety", "heart-cardio", "diabetes-care", "pain-relief", "digestive-health"] },
];

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [activeNavKey, setActiveNavKey] = useState<string>(() => {
    return searchParams.get("nav") || "all";
  });
  const [heroSearch, setHeroSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Look up category/brand IDs from slugs
  const allCategories = useQuery(api.categories.list);
  const allBrands = useQuery(api.publicBrands.list);

  const selectedCategoryId = allCategories?.find((c) => c.slug === selectedCategorySlug)?._id;
  const selectedBrandId = allBrands?.find((b) => b.slug === selectedBrandSlug)?._id;

  /* ────────────────────────────────────────────────────────
     Resolve active nav category → set of DB slugs to filter
     ──────────────────────────────────────────────────────── */
  const navFilterSlugs = useMemo(() => {
    const nav = NAV_CATEGORIES.find((n) => n.key === activeNavKey);
    if (!nav || !nav.filterSlugs) return null;
    return nav.filterSlugs;
  }, [activeNavKey]);

  /* When a nav category is clicked, clear sidebar category filter
     and set the nav slug. When "all" is clicked, clear both. */
  const handleNavClick = (key: string) => {
    setActiveNavKey(key);
    setSelectedCategorySlug("");
    setSelectedBrandSlug("");
    setSearchQuery("");
    setAutocompleteQuery("");
    setPrescriptionFilter("");
    setStockFilter("");
  };

  /* ────────────────────────────────────────────────────────
     Determine which DB category IDs to pass to the search query.
     If nav filter is active, gather all category IDs whose slug
     matches the nav filter slugs. Otherwise use sidebar selection.
     ──────────────────────────────────────────────────────── */
  const effectiveCategoryId = useMemo(() => {
    // Sidebar category takes precedence if explicitly selected
    if (selectedCategoryId) return selectedCategoryId;
    // Nav filter: collect IDs of matching categories
    if (navFilterSlugs && allCategories) {
      const matching = allCategories.filter((c) => navFilterSlugs.includes(c.slug));
      return matching.length > 0 ? matching[0]._id : undefined;
    }
    return undefined;
  }, [selectedCategoryId, navFilterSlugs, allCategories]);

  // Autocomplete suggestions
  const suggestions = useQuery(
    api.publicProducts.autocomplete,
    autocompleteQuery.length >= 2 ? { query: autocompleteQuery } : "skip"
  );

  // Main search query
  const products = useQuery(api.publicProducts.search, {
    query: searchQuery || "",
    categoryId: effectiveCategoryId as any,
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
    if (activeNavKey && activeNavKey !== "all") params.set("nav", activeNavKey);
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCategorySlug, selectedBrandSlug, sortBy, prescriptionFilter, stockFilter, activeNavKey, setSearchParams]);

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

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroSearch.trim()) {
      setSearchQuery(heroSearch.trim());
      setActiveNavKey("all");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategorySlug("");
    setSelectedBrandSlug("");
    setSortBy("relevance");
    setPrescriptionFilter("");
    setStockFilter("");
    setActiveNavKey("all");
    setHeroSearch("");
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = searchQuery || selectedCategorySlug || selectedBrandSlug || prescriptionFilter || stockFilter || activeNavKey !== "all";

  const isLoading = products === undefined || allCategories === undefined;

  /* ────────────────────────────────────────────────────────
     Compute nav category counts from DB categories
     ──────────────────────────────────────────────────────── */
  const navCategoryCounts = useMemo(() => {
    if (!allCategories) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const nav of NAV_CATEGORIES) {
      if (!nav.filterSlugs) {
        counts[nav.key] = allCategories.reduce((sum, c) => sum + (c as any).productCount, 0);
      } else {
        counts[nav.key] = allCategories
          .filter((c) => nav.filterSlugs!.includes(c.slug))
          .reduce((sum, c) => sum + (c as any).productCount, 0);
      }
    }
    return counts;
  }, [allCategories]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* ════════════════════════════════════════════════════
            CATEGORY NAVIGATION BAR
            ════════════════════════════════════════════════════ */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="mx-auto max-w-7xl overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-0 min-w-max">
              {NAV_CATEGORIES.map((cat) => {
                const isActive = cat.key === activeNavKey;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleNavClick(cat.key)}
                    className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "text-primary-foreground bg-primary"
                        : "text-gray-700 hover:text-primary hover:bg-primary/5"
                    }`}
                  >
                    {cat.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* ════════════════════════════════════════════════════
            HERO SEARCH SECTION
            ════════════════════════════════════════════════════ */}
        <section className="relative bg-gradient-to-br from-[#0f2035] via-[#162d4a] to-[#1a3555] overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-10 md:py-16">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {/* Left: Illustrations (hidden on mobile) */}
              <div className="hidden lg:flex items-center gap-4 shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-white/80" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white/70" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white/60" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                </div>
              </div>

              {/* Center: Heading + Search */}
              <div className="flex-1 text-center max-w-2xl mx-auto">
                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight mb-4"
                >
                  Buy Medicines and Essentials
                </motion.h1>

                <motion.form
                  onSubmit={handleHeroSearch}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className="relative max-w-xl mx-auto"
                >
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                    <input
                      type="text"
                      value={heroSearch}
                      onChange={(e) => setHeroSearch(e.target.value)}
                      placeholder="Search Medicines"
                      className="w-full h-12 sm:h-14 pl-12 pr-32 sm:pr-36 rounded-xl bg-white text-gray-900 placeholder-gray-400 text-base sm:text-lg font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                    <button
                      type="submit"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 sm:h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Search
                    </button>
                  </div>
                </motion.form>

                {/* Quick search tags */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="flex flex-wrap justify-center gap-2 mt-4"
                >
                  {["Paracetamol", "Vitamin C", "Cough Syrup", "Diabetes", "Skin Care"].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => { setHeroSearch(tag); setSearchQuery(tag); setActiveNavKey("all"); }}
                      className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium hover:bg-white/20 transition-colors border border-white/10"
                    >
                      {tag}
                    </button>
                  ))}
                </motion.div>
              </div>

              {/* Right: Illustrations (hidden on mobile) */}
              <div className="hidden lg:flex items-center gap-4 shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white/60" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white/70" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-white/80" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            PRODUCT LISTING AREA (existing filters + grid)
            ════════════════════════════════════════════════════ */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="mb-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3" />
                {                  activeNavKey !== "all"
                  ? NAV_CATEGORIES.find((n) => n.key === activeNavKey)?.label || "Category"
                  : "Medicine Catalogue"}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : selectedCategorySlug
                  ? allCategories?.find((c) => c.slug === selectedCategorySlug)?.name ?? "Category"
                  : selectedBrandSlug
                  ? allBrands?.find((b) => b.slug === selectedBrandSlug)?.name ?? "Brand"
                  :                  activeNavKey !== "all"
                  ? NAV_CATEGORIES.find((n) => n.key === activeNavKey)?.label ?? "Products"
                  : "All Medicines"}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {products ? `${products.length} product(s) found` : "Browse our catalogue of genuine medicines and healthcare products."}
              </p>
            </motion.div>
          </div>

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
                        !selectedCategorySlug && activeNavKey === "all"
                          ? "bg-primary/10 text-primary font-semibold shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() => { setSelectedCategorySlug(""); setActiveNavKey("all"); }}
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
