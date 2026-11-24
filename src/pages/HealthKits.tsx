import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Filter,
  Package,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { stagePendingCartLine } from "@/lib/pending-cart";
import { formatCurrency } from "@/lib/auth-utils";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=2000&q=85";

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /not authenticated|unauthenticated|sign.?in|unauthorized/i.test(message);
}

type KitSort = "featured" | "price_low" | "price_high" | "newest" | "discount";

function KitImage({
  src,
  alt,
  className = "",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`h-full w-full object-contain ${className}`}
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-primary/5 ${className}`}>
      <Package className="size-10 text-primary/45" strokeWidth={1.4} aria-hidden="true" />
    </div>
  );
}

function categoryIcon(index: number) {
  const icons = [Stethoscope, Truck, ShieldCheck, Sparkles, Package];
  const Icon = icons[index % icons.length];
  return <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />;
}

export default function HealthKits() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("category") ?? "";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<KitSort>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);

  const categories = useQuery(api.healthKits.categories);
  const kits = useQuery(api.healthKits.list, {
    search: search.trim() || undefined,
    categorySlug: selectedCategory || undefined,
    sort,
    inStockOnly,
  });
  const addToCart = useMutation(api.cart.addItem);

  const setCategory = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  };

  const scrollToKits = () => {
    document.getElementById("all-health-kits")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAdd = async (kit: NonNullable<typeof kits>[number]) => {
    if (!kit.available) {
      toast.error(kit.unavailableReason || "This kit is currently unavailable");
      return;
    }
    const signInUrl = `/auth?returnTo=${encodeURIComponent(`/health-kits/${kit.slug}`)}`;
    if (!user) {
      stagePendingCartLine(kit._id as any);
      toast.success(`${kit.name} saved — sign in to add it to your cart`);
      navigate(signInUrl);
      return;
    }
    try {
      await addToCart({ productId: kit._id as any, quantity: 1 });
      toast.success(`${kit.name} added to cart`);
    } catch (error: any) {
      if (isAuthError(error)) {
        toast.error("Please sign in to add items to cart");
        navigate(signInUrl);
      } else {
        toast.error(error?.message || "Could not add this kit to your cart");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* ── Hero ── */}
        <section className="relative isolate overflow-hidden bg-[#072f25] text-white">
          <img
            src={HERO_IMAGE}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-80"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(5,37,29,0.97)_0%,rgba(7,47,37,0.93)_42%,rgba(8,52,40,0.62)_72%,rgba(8,52,40,0.72)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-t from-[#062a21]/85 to-transparent" />
          <div
            className="pointer-events-none absolute -right-24 top-8 -z-10 size-80 rounded-full bg-[#a9c7ad]/15 blur-3xl"
            aria-hidden="true"
          />

          <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-8 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end lg:gap-14 lg:pb-20 lg:pt-20">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-50 backdrop-blur-sm">
                <Sparkles className="size-3.5 text-emerald-200" />
                Kalyan Chemist · Health Kits
              </div>
              <h1 className="mt-4 max-w-xl font-serif text-[2rem] font-bold leading-[1.06] tracking-tight min-[360px]:text-[2.25rem] sm:mt-5 sm:text-5xl lg:text-[3.6rem]">
                Health &amp; Care Kits
              </h1>
              <p className="mt-3 max-w-lg text-[15px] font-medium leading-relaxed text-emerald-50/95 sm:mt-4 sm:text-lg">
                Everyday health essentials, thoughtfully packed for you.
              </p>
              <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-emerald-50/70 sm:mt-3 sm:text-[15px]">
                Practical collections for home, travel and family care — with every
                included product listed clearly before you buy.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center">
                <Button
                  className="h-11 rounded-full bg-[#f8f5ec] px-6 text-sm font-semibold text-[#0a3d2e] shadow-lg shadow-black/10 hover:bg-white"
                  onClick={scrollToKits}
                >
                  Explore Kits <ArrowRight className="size-4" />
                </Button>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-emerald-50/75">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-300" /> Catalogue-backed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-300" /> Clear contents
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-300" /> Same checkout
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block"
              aria-label="What to expect from our health kits"
            >
              <div className="rounded-[28px] border border-white/15 bg-[#05281f]/45 p-6 shadow-2xl shadow-black/20 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-emerald-100">
                    <PackageCheck className="size-5" strokeWidth={1.5} />
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-100/55">
                    Inside every kit
                  </span>
                </div>
                <p className="mt-6 font-serif text-2xl font-semibold leading-snug">
                  Essential care,
                  <br />
                  considered.
                </p>
                <div className="mt-6 space-y-3.5">
                  {[
                    "Products grouped around everyday needs",
                    "Contents and quantities shown upfront",
                    "Live availability from our catalogue",
                  ].map((text) => (
                    <p key={text} className="flex items-start gap-2.5 text-xs leading-relaxed text-emerald-50/80">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-200">
                        <Check className="size-2.5" strokeWidth={2.5} />
                      </span>
                      {text}
                    </p>
                  ))}
                </div>
              </div>
            </motion.aside>
          </div>
        </section>

        {/* ── Categories ── */}
        <section className="border-b border-border/60 bg-[#f7f5ee] dark:bg-background">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/65">
                  Find your fit
                </p>
                <h2 className="mt-1.5 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                  Shop by category
                </h2>
              </div>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setCategory("")}
                  className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                >
                  View all kits
                </button>
              )}
            </div>

            {categories === undefined ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                {[0, 1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-[158px] animate-pulse rounded-[22px] bg-muted sm:h-[184px]" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-border bg-card/60 px-5 py-10 text-center text-sm text-muted-foreground">
                Kit collections will appear here as soon as they are published.
              </div>
            ) : (
              <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                {categories.map((category, index) => {
                  const active = selectedCategory === category.slug;
                  return (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => setCategory(active ? "" : category.slug)}
                      aria-pressed={active}
                      className={`group relative flex h-full min-h-[158px] min-w-0 flex-col overflow-hidden rounded-[22px] border p-4 text-left transition-all duration-300 sm:min-h-[184px] sm:p-5 ${
                        active
                          ? "border-primary/40 bg-[#edf4ec] shadow-[0_10px_30px_-18px_rgba(10,61,46,0.45)] ring-1 ring-primary/15 dark:bg-primary/10"
                          : "border-border/60 bg-card/85 hover:-translate-y-1 hover:border-primary/25 hover:bg-card hover:shadow-[0_18px_36px_-24px_rgba(10,61,46,0.35)]"
                      }`}
                    >
                      <div
                        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/[0.04] transition-transform duration-500 group-hover:scale-125 dark:bg-white/[0.03]"
                        aria-hidden="true"
                      />
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`flex size-11 items-center justify-center overflow-hidden rounded-2xl transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/[0.08] text-primary group-hover:bg-primary/10"
                          }`}
                        >
                          {category.imageUrl ? (
                            <img
                              src={category.imageUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            categoryIcon(index)
                          )}
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[9px] font-semibold text-muted-foreground">
                          {category.kitCount} {category.kitCount === 1 ? "kit" : "kits"}
                        </span>
                      </div>

                      <div className="relative mt-4 min-w-0 sm:mt-5">
                        <p className="break-words text-[13px] font-semibold leading-snug tracking-tight sm:text-[15px]">
                          {category.name}
                        </p>
                        {category.description && (
                          <p className="mt-1.5 hidden text-[11px] leading-relaxed text-muted-foreground sm:line-clamp-2">
                            {category.description}
                          </p>
                        )}
                      </div>

                      <span className="relative mt-auto flex items-center gap-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary/75 sm:pt-4 sm:text-[10px]">
                        {active ? "Showing" : "Explore"}
                        <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Kits ── */}
        <section
          id="all-health-kits"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 sm:py-14"
        >
          <div className="mb-6 flex flex-col gap-4 sm:mb-7 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/65">
                Thoughtfully assembled
              </p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                  All Health Kits
                </h2>
                {kits !== undefined && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {kits.length} {kits.length === 1 ? "kit" : "kits"}
                  </span>
                )}
              </div>
            </div>

            <div className="grid w-full min-w-0 grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:items-center">
              <div className="relative col-span-2 min-w-0 sm:w-[240px] sm:flex-none lg:w-[260px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search kits or included products"
                  className="h-11 w-full rounded-xl border-border/80 bg-card pl-10 text-sm shadow-sm"
                  aria-label="Search health kits"
                />
              </div>
              <Select value={sort} onValueChange={(value) => setSort(value as KitSort)}>
                <SelectTrigger
                  className="h-11 min-h-11 w-full min-w-0 rounded-xl border-border/80 bg-card text-xs shadow-sm sm:w-[165px]"
                  aria-label="Sort health kits"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Recommended</SelectItem>
                  <SelectItem value="price_low">Price: low to high</SelectItem>
                  <SelectItem value="price_high">Price: high to low</SelectItem>
                  <SelectItem value="discount">Biggest savings</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setInStockOnly((value) => !value)}
                aria-pressed={inStockOnly}
                className={`inline-flex h-11 min-w-0 w-full items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold shadow-sm transition-colors sm:w-auto sm:gap-2 sm:px-4 sm:text-xs ${
                  inStockOnly
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground"
                }`}
              >
                <Filter className="size-3.5" /> In stock only
              </button>
            </div>
          </div>

          {kits === undefined ? (
            <div className="grid auto-rows-fr grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
                <div
                  key={item}
                  className="animate-pulse overflow-hidden rounded-[22px] border border-border/60 bg-card"
                >
                  <div className="aspect-[4/3] bg-muted" />
                  <div className="space-y-2.5 p-4">
                    <div className="h-2.5 w-1/3 rounded bg-muted" />
                    <div className="h-3.5 w-4/5 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-14 w-full rounded-xl bg-muted" />
                    <div className="h-10 w-full rounded-xl bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : kits.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border bg-[#f7f5ee] px-6 py-16 text-center dark:bg-card/40 sm:py-20">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.07] text-primary">
                <Package className="size-6" strokeWidth={1.5} />
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold">
                {search || selectedCategory || inStockOnly
                  ? "No kits match this selection"
                  : "Health kits are on the way"}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {search || selectedCategory || inStockOnly
                  ? "Try another category, clear your search, or turn off the stock filter."
                  : "New curated kits will appear here as soon as they are published."}
              </p>
              {(search || selectedCategory || inStockOnly) && (
                <Button
                  variant="outline"
                  className="mt-6 rounded-full bg-card px-5"
                  onClick={() => {
                    setSearch("");
                    setInStockOnly(false);
                    setCategory("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid auto-rows-fr grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {kits.map((kit, index) => (
                <motion.article
                  key={kit._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.035 }}
                  className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-border/65 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_22px_45px_-28px_rgba(10,61,46,0.42)]"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/health-kits/${kit.slug}`)}
                    className="relative block aspect-[16/9] w-full overflow-hidden bg-[#f4f6f1] p-3.5 sm:aspect-[4/3] sm:p-4"
                    aria-label={`View ${kit.name}`}
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/75 to-transparent"
                      aria-hidden="true"
                    />
                    <KitImage
                      src={kit.imageUrl}
                      alt={kit.name}
                      className="relative transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    {kit.discountPercent > 0 && (
                      <Badge className="absolute left-2.5 top-2.5 z-10 rounded-full border-0 bg-[#8a5a2b] px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-[#fffaf2] shadow-sm sm:left-3 sm:top-3">
                        {kit.discountPercent}% OFF
                      </Badge>
                    )}
                  </button>

                  <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/65">
                        {kit.categoryName ?? "Health kit"}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold ${
                          kit.available ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            kit.available ? "bg-emerald-500" : "bg-destructive"
                          }`}
                        />
                        {kit.available
                          ? `${kit.maxQuantity} kit${kit.maxQuantity === 1 ? "" : "s"} available`
                          : "Out of stock"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/health-kits/${kit.slug}`)}
                      className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-left text-sm font-semibold leading-snug tracking-tight transition-colors hover:text-primary sm:text-[15px]"
                    >
                      {kit.name}
                    </button>

                    <p className="mt-1 line-clamp-2 min-h-[2.25rem] text-[11.5px] leading-relaxed text-muted-foreground sm:text-xs">
                      {kit.description}
                    </p>

                    <div className="mt-2.5 min-h-[54px] rounded-lg border border-primary/[0.09] bg-[#f3f6ef] px-2.5 py-2 dark:bg-primary/[0.06]">
                      <p className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.13em] text-primary/65">
                        <Package className="size-3" /> Inside this kit
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-foreground/70 sm:text-[11px]">
                        {kit.componentNames.length > 0
                          ? `${kit.componentNames.slice(0, 3).join(" · ")}${
                              kit.componentNames.length > 3
                                ? ` +${kit.componentNames.length - 3} more`
                                : ""
                            }`
                          : `${kit.componentCount} included ${
                              kit.componentCount === 1 ? "product" : "products"
                            }`}
                      </p>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-xl font-bold tracking-tight sm:text-[1.35rem]">
                        {formatCurrency(kit.sellingPrice)}
                      </span>
                      {kit.savings > 0 && (
                        <>
                          <span className="text-[11px] text-muted-foreground line-through">
                            {formatCurrency(kit.mrp)}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 sm:text-[10.5px]">
                            Save {formatCurrency(kit.savings)}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-auto flex items-center gap-2 pt-3">
                      <Button
                        size="sm"
                        className="h-11 min-w-0 flex-[1.15] gap-1.5 rounded-xl px-2 text-[11px] font-semibold sm:text-xs"
                        disabled={!kit.available}
                        onClick={() => handleAdd(kit)}
                      >
                        <ShoppingCart className="size-3.5 shrink-0 sm:size-4" />
                        <span className="truncate">Add to cart</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-11 min-w-0 flex-1 gap-1 rounded-xl border-primary/30 bg-transparent px-2 text-[11px] font-semibold text-primary hover:bg-primary/5 sm:text-xs"
                        onClick={() => navigate(`/health-kits/${kit.slug}`)}
                      >
                        <span className="truncate">View details</span>
                        <ArrowUpRight className="hidden size-3.5 shrink-0 min-[560px]:block" />
                      </Button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </section>

        {/* ── Why choose our kits ── */}
        <section className="border-y border-border/60 bg-[#f7f5ee] dark:bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="max-w-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/65">
                Care, considered
              </p>
              <h2 className="mt-1.5 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                Why choose our kits?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A simpler way to keep everyday health essentials close at hand.
              </p>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {[
                {
                  icon: PackageCheck,
                  title: "Thoughtfully grouped",
                  text: "Each kit brings related essentials together from our existing pharmacy catalogue.",
                },
                {
                  icon: ShieldCheck,
                  title: "Clear from the start",
                  text: "See every included product and quantity before you add a kit to your cart.",
                },
                {
                  icon: Truck,
                  title: "One familiar checkout",
                  text: "Kits use the same cart, delivery and payment flow you already know.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[22px] border border-border/60 bg-card p-5 shadow-[0_12px_30px_-26px_rgba(10,61,46,0.32)]"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
                    <item.icon className="size-[18px]" strokeWidth={1.6} />
                  </div>
                  <p className="mt-4 text-sm font-semibold tracking-tight">{item.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Closing ── */}
        <section className="relative isolate overflow-hidden bg-[#0a3d2e] text-white">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(circle at 78% 20%, rgba(167,243,208,0.16) 0, transparent 30%), radial-gradient(circle at 12% 90%, rgba(255,255,255,0.08) 0, transparent 28%)",
            }}
            aria-hidden="true"
          />
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/70">
                Ready when you are
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
                Find a kit that fits your everyday.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-emerald-50/70">
                Browse the full collection, compare what&apos;s inside, and choose
                the essentials that suit your home.
              </p>
            </div>
            <Button
              className="h-11 w-full shrink-0 rounded-full bg-[#f8f5ec] px-6 text-sm font-semibold text-[#0a3d2e] hover:bg-white md:w-auto"
              onClick={scrollToKits}
            >
              Explore all kits <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
