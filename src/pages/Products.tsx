import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Search,
  X,
  PackageOpen,
  Sparkles,
  Pill,
} from "lucide-react";

// Phase 1: placeholder categories for UI
const PLACEHOLDER_CATEGORIES = [
  { id: "1", name: "Pain & Relief", slug: "pain-relief" },
  { id: "2", name: "Heart & Cardio", slug: "heart-cardio" },
  { id: "3", name: "Diabetes Care", slug: "diabetes-care" },
  { id: "4", name: "Vitamins & Supplements", slug: "vitamins-supplements" },
  { id: "5", name: "Baby & Mother", slug: "baby-mother" },
  { id: "6", name: "Mind & Neurology", slug: "mind-neurology" },
];

export default function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "";

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(initialCategory);

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
        <div className="bg-gradient-to-b from-primary/[0.03] to-transparent border-b border-border/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3" />
                Medicine Catalogue
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : "All Medicines"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Browse our catalogue of genuine medicines and healthcare products.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="flex gap-8">
            {/* Desktop sidebar filters */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">
                    Search
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 rounded-xl"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">
                    Categories
                  </h3>
                  <div className="space-y-1">
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
                    {PLACEHOLDER_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                          selectedCategorySlug === cat.slug
                            ? "bg-primary/10 text-primary font-semibold shadow-sm"
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
              </div>

              {/* Active filter chips */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1 text-xs rounded-lg">
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
                  {selectedCategorySlug && (
                    <Badge variant="secondary" className="gap-1 text-xs rounded-lg">
                      {
                        PLACEHOLDER_CATEGORIES.find(
                          (c) => c.slug === selectedCategorySlug
                        )?.name
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

              {/* Phase 1: placeholder products coming soon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Pill className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Products Coming Soon
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-sm leading-relaxed">
                  Our medicine catalogue will be available in Phase 2. We are
                  working on bringing you a comprehensive selection of genuine
                  healthcare products.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 text-sm rounded-xl"
                  onClick={() => navigate("/")}
                >
                  Back to Home
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
