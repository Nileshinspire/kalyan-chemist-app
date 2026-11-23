import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Filter,
  Package,
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

  const heroKits = useMemo(
    () => (kits ?? []).filter((kit) => kit.imageUrl).slice(0, 3),
    [kits],
  );

  const setCategory = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug);
    else next.delete("category");
    setSearchParams(next, { replace: true });
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
        <section className="relative overflow-hidden bg-[#0b3f30] text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.13]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 25%, #ffffff 0, transparent 28%), radial-gradient(circle at 82% 70%, #a7f3d0 0, transparent 32%)",
            }}
          />
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-16">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50">
                <Sparkles className="size-3.5" /> Curated by Kalyan Chemist
              </div>
              <h1 className="font-serif text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
                Health &amp; Care Kits
              </h1>
              <p className="mt-3 text-base font-medium text-emerald-100 sm:text-lg">
                Everyday care, thoughtfully packed.
              </p>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-emerald-50/85 sm:text-[15px]">
                Explore curated healthcare kits for home, travel, little ones and
                everyday personal care. Each kit brings essential products together,
                with every included item listed clearly before you buy.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-emerald-50/85">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-300" /> Real catalogue products
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-300" /> One cart &amp; checkout
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-300" /> Live availability
                </span>
              </div>
              <Button
                className="mt-7 h-10 rounded-full bg-white px-6 text-[#0b3f30] hover:bg-emerald-50"
                onClick={() =>
                  document.getElementById("all-health-kits")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Explore health kits <ArrowRight className="size-4" />
              </Button>
            </motion.div>

            {/* Real kit imagery when available, premium first-aid composition otherwise. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto w-full max-w-md lg:max-w-none"
            >
              <div className="grid grid-cols-5 grid-rows-6 gap-2.5 sm:gap-3">
                <div className="col-span-3 row-span-4 overflow-hidden rounded-2xl border border-white/15 bg-white p-3 shadow-2xl">
                  {heroKits[0] ? (
                    <KitImage src={heroKits[0].imageUrl} alt={heroKits[0].name} />
                  ) : (
                    <FirstAidIllustration />
                  )}
                </div>
                <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl border border-white/10 bg-[#145a45] p-3">
                  {heroKits[1] ? (
                    <KitImage src={heroKits[1].imageUrl} alt={heroKits[1].name} />
                  ) : (
                    <div className="flex h-full flex-col justify-between text-emerald-50">
                      <ShieldCheck className="size-7 text-emerald-200" strokeWidth={1.3} />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
                          Quality first
                        </p>
                        <p className="mt-1 text-xs leading-snug">
                          Products selected from our existing pharmacy catalogue.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-span-2 row-span-3 overflow-hidden rounded-2xl border border-white/10 bg-emerald-50 p-3 text-[#0b3f30]">
                  {heroKits[2] ? (
                    <KitImage src={heroKits[2].imageUrl} alt={heroKits[2].name} />
                  ) : (
                    <div className="flex h-full flex-col justify-between">
                      <div className="flex size-8 items-center justify-center rounded-full bg-[#0b3f30]/10">
                        <Package className="size-4" strokeWidth={1.6} />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0b3f30]/60">
                          Packed with care
                        </p>
                        <p className="mt-1 text-xs leading-snug">
                          Clear contents, quantities and pricing — no surprises.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="col-span-3 row-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-4 backdrop-blur">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      Kalyan Chemist
                    </p>
                    <p className="mt-0.5 text-sm font-semibold">Care, together.</p>
                  </div>
                  <Stethoscope className="size-7 text-emerald-200" strokeWidth={1.4} />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Category discovery ── */}
        <section className="border-b border-border/60 bg-card">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                  Find your fit
                </p>
                <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                  Explore Health Kits
                </h2>
              </div>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setCategory("")}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View all kits
                </button>
              )}
            </div>

            {categories === undefined ? (
              <div className="flex gap-3 overflow-hidden">
                {[0, 1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-28 min-w-[150px] flex-1 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground">
                Kit collections will appear here as soon as they are published.
              </div>
            ) : (
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
                {categories.map((category, index) => {
                  const active = selectedCategory === category.slug;
                  return (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => setCategory(active ? "" : category.slug)}
                      className={`group relative min-w-[152px] snap-start overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 sm:min-w-0 ${
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/70 bg-background hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      }`}
                    >
                      <div
                        className={`mb-3 flex size-11 items-center justify-center overflow-hidden rounded-xl ${
                          active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
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
                      </div>
                      <p className="text-sm font-semibold leading-snug">{category.name}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {category.kitCount} {category.kitCount === 1 ? "kit" : "kits"}
                      </p>
                      <ChevronRight
                        className={`absolute right-3 top-4 size-4 transition-transform ${
                          active ? "text-primary" : "text-muted-foreground/40 group-hover:translate-x-0.5 group-hover:text-primary"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── All kits ── */}
        <section id="all-health-kits" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-9 sm:px-6 sm:py-12">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                Thoughtfully assembled
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                All Health Kits
              </h2>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search kits or included products"
                  className="h-10 w-full rounded-full border-border/80 bg-background pl-9 text-sm sm:w-[260px]"
                  aria-label="Search health kits"
                />
              </div>
              <Select value={sort} onValueChange={(value) => setSort(value as KitSort)}>
                <SelectTrigger className="h-10 min-h-10 w-full rounded-full sm:w-[160px]" aria-label="Sort health kits">
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
                className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border px-4 text-xs font-semibold transition-colors sm:w-auto ${
                  inStockOnly
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <Filter className="size-3.5" /> In stock only
              </button>
            </div>
          </div>

          {kits === undefined ? (
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
                <div key={item} className="animate-pulse overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <div className="aspect-square bg-muted" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-7 w-full rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : kits.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Package className="size-6" strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {search || selectedCategory || inStockOnly
                  ? "No kits match this selection"
                  : "Health kits are on the way"}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {search || selectedCategory || inStockOnly
                  ? "Try another category, clear your search, or turn off the stock filter."
                  : "New curated kits will appear here as soon as they are published."}
              </p>
              {(search || selectedCategory || inStockOnly) && (
                <Button
                  variant="outline"
                  className="mt-5 rounded-full"
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
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {kits.map((kit, index) => (
                <motion.article
                  key={kit._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.035 }}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/health-kits/${kit.slug}`)}
                    className="relative block aspect-square w-full overflow-hidden bg-white p-3 max-sm:p-2"
                    aria-label={`View ${kit.name}`}
                  >
                    {kit.discountPercent > 0 && (
                      <Badge className="absolute left-2 top-2 z-10 rounded-full bg-primary text-[10px] text-primary-foreground sm:left-3 sm:top-3">
                        {kit.discountPercent}% OFF
                      </Badge>
                    )}
                    <KitImage
                      src={kit.imageUrl}
                      alt={kit.name}
                      className="transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </button>
                  <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">
                      {kit.categoryName ?? "Health kit"}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(`/health-kits/${kit.slug}`)}
                      className="mt-1 line-clamp-2 text-left text-[13px] font-semibold leading-snug hover:text-primary sm:text-[15px]"
                    >
                      {kit.name}
                    </button>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                      {kit.description}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground sm:text-[11px]">
                      {kit.componentCount} included {kit.componentCount === 1 ? "product" : "products"}
                    </p>

                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-base font-bold tracking-tight sm:text-lg">
                        {formatCurrency(kit.sellingPrice)}
                      </span>
                      {kit.savings > 0 && (
                        <>
                          <span className="text-[11px] text-muted-foreground line-through">
                            {formatCurrency(kit.mrp)}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700">
                            Save {formatCurrency(kit.savings)}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                          kit.available ? "text-emerald-700" : "text-destructive"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            kit.available ? "bg-emerald-500" : "bg-destructive"
                          }`}
                        />
                        {kit.available ? "In stock" : "Out of stock"}
                      </span>
                    </div>

                    <div className="mt-auto grid grid-cols-1 gap-1.5 pt-3 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-full px-3 text-[11px] sm:h-9 sm:text-xs"
                        onClick={() => navigate(`/health-kits/${kit.slug}`)}
                      >
                        View details
                      </Button>
                      <Button
                        size="sm"
                        className="h-10 rounded-full px-3 text-[11px] sm:h-9 sm:text-xs"
                        disabled={!kit.available}
                        onClick={() => handleAdd(kit)}
                      >
                        <ShoppingCart className="size-3.5" /> Add
                      </Button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </section>

        {/* ── Closing reassurance strip ── */}
        <section className="border-t border-border/60 bg-primary/[0.035]">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:grid-cols-3 sm:px-6">
            {[
              {
                icon: ShieldCheck,
                title: "Genuine products",
                text: "Every kit is built from products already stocked in our catalogue.",
              },
              {
                icon: Package,
                title: "Clear contents",
                text: "See every included product and its quantity before adding a kit.",
              },
              {
                icon: Truck,
                title: "Existing checkout",
                text: "Kits use the same cart, delivery and payment flow you already know.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-4" strokeWidth={1.6} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function FirstAidIllustration() {
  return (
    <svg viewBox="0 0 320 260" className="h-full w-full" role="img" aria-label="First aid kit illustration">
      <rect x="42" y="72" width="236" height="144" rx="22" fill="#f0fdf4" stroke="#0b3f30" strokeWidth="3" />
      <path d="M112 72V54a14 14 0 0 1 14-14h68a14 14 0 0 1 14 14v18" fill="none" stroke="#0b3f30" strokeWidth="4" strokeLinecap="round" />
      <rect x="52" y="160" width="216" height="46" rx="12" fill="#dcfce7" />
      <rect x="133" y="104" width="54" height="54" rx="13" fill="#ffffff" stroke="#0b3f30" strokeWidth="3" />
      <path d="M160 116v30M145 131h30" stroke="#0b3f30" strokeWidth="4" strokeLinecap="round" />
      <circle cx="86" cy="118" r="12" fill="#ffffff" stroke="#0b3f30" strokeWidth="2.5" />
      <path d="M86 111v14M79 118h14" stroke="#0b3f30" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="220" y="102" width="34" height="46" rx="9" fill="#ffffff" stroke="#0b3f30" strokeWidth="2.5" />
      <path d="M228 116h18M228 124h18M228 132h12" stroke="#0b3f30" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M84 178h50" stroke="#0b3f30" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <path d="M146 178h48" stroke="#0b3f30" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <path d="M206 178h28" stroke="#0b3f30" strokeWidth="2.5" strokeLinecap="round" opacity="0.18" />
    </svg>
  );
}
