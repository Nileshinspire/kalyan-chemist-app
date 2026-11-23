import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/auth-utils";
import { stagePendingCartLine } from "@/lib/pending-cart";

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /not authenticated|unauthenticated|sign.?in|unauthorized/i.test(message);
}

export default function HealthKitDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const kit = useQuery(api.healthKits.getBySlug, slug ? { slug } : "skip");
  const addToCart = useMutation(api.cart.addItem);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setQuantity(1);
    setActiveImage(0);
  }, [slug]);

  const images = useMemo(() => {
    if (!kit) return [];
    return kit.images.length > 0 ? kit.images : [];
  }, [kit]);

  if (kit === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-[55vh] items-center justify-center">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (kit === null) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Package className="size-7" strokeWidth={1.5} />
          </div>
          <h1 className="mt-5 font-serif text-2xl font-bold">Health kit not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This kit may have been unpublished or the link is no longer valid.
          </p>
          <Button className="mt-6 rounded-full" onClick={() => navigate("/health-kits")}>
            Browse health kits
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const maxQuantity = Math.max(1, kit.maxQuantity);
  const handleAdd = async () => {
    const signInUrl = `/auth?returnTo=${encodeURIComponent(`/health-kits/${kit.slug}`)}`;
    if (!user) {
      stagePendingCartLine(kit._id as any);
      toast.success(`${kit.name} saved — sign in to add it to your cart`);
      navigate(signInUrl);
      return;
    }
    setAdding(true);
    try {
      await addToCart({ productId: kit._id as any, quantity });
      toast.success(`${kit.name} added to cart`);
    } catch (error: any) {
      if (isAuthError(error)) {
        toast.error("Please sign in to add items to cart");
        navigate(signInUrl);
      } else {
        toast.error(error?.message || "Could not add this kit to your cart");
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">Home</Link>
          <ChevronRight className="size-3" />
          <Link to="/health-kits" className="hover:text-primary">Health Kits</Link>
          <ChevronRight className="size-3" />
          <span className="max-w-[55vw] truncate text-foreground">{kit.name}</span>
        </nav>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-12">
          {/* Gallery */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-white">
              <div className="flex aspect-square items-center justify-center p-5 sm:p-8">
                {images[activeImage] ? (
                  <img
                    src={images[activeImage]}
                    alt={kit.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-primary/5 text-primary/50">
                    <Package className="size-16" strokeWidth={1.2} />
                    <span className="mt-3 text-xs font-medium">Kit image coming soon</span>
                  </div>
                )}
              </div>
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`size-16 shrink-0 overflow-hidden rounded-xl border bg-white p-1.5 transition-colors ${
                      activeImage === index ? "border-primary ring-1 ring-primary/30" : "border-border/70"
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Buy box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="min-w-0 lg:pt-1"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full bg-primary/10 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {kit.category.name}
              </Badge>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  kit.available
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                <span className={`size-1.5 rounded-full ${kit.available ? "bg-emerald-500" : "bg-destructive"}`} />
                {kit.available ? `In stock · ${kit.maxQuantity} available` : "Out of stock"}
              </span>
            </div>

            <h1 className="mt-3 font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {kit.name}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              {kit.description}
            </p>

            <div className="mt-5 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-3xl font-bold tracking-tight">{formatCurrency(kit.sellingPrice)}</span>
                {kit.savings > 0 && (
                  <>
                    <span className="pb-1 text-sm text-muted-foreground line-through">
                      {formatCurrency(kit.mrp)}
                    </span>
                    <span className="mb-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      Save {formatCurrency(kit.savings)}
                      {kit.discountPercent > 0 ? ` · ${kit.discountPercent}% off` : ""}
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Inclusive of all applicable product discounts. Taxes and delivery are calculated at checkout.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex h-11 items-center rounded-full border border-border/80 bg-background">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    disabled={quantity <= 1 || !kit.available}
                    className="flex h-full w-10 items-center justify-center rounded-l-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                    disabled={quantity >= maxQuantity || !kit.available}
                    className="flex h-full w-10 items-center justify-center rounded-r-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <Button
                  size="lg"
                  disabled={!kit.available || adding}
                  onClick={handleAdd}
                  className="h-11 flex-1 rounded-full text-sm font-semibold"
                >
                  {adding ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                  {adding ? "Adding…" : kit.available ? "Add Kit to Cart" : "Currently unavailable"}
                </Button>
              </div>
              {!kit.available && kit.unavailableReason && (
                <p className="mt-2 text-xs font-medium text-destructive">{kit.unavailableReason}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Truck className="size-3.5" /> Existing delivery options</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Genuine catalogue products</span>
                <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> One cart &amp; checkout</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Included products</p>
                <p className="mt-0.5 font-semibold">{kit.components.length}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total units</p>
                <p className="mt-0.5 font-semibold">
                  {kit.components.reduce((sum, item) => sum + item.quantity, 0)}
                </p>
              </div>
              <div className="col-span-2 rounded-xl bg-muted/50 px-3 py-2.5 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kit availability</p>
                <p className="mt-0.5 font-semibold">{kit.available ? `${kit.maxQuantity} complete kits` : "Unavailable"}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Included products */}
        <section className="mt-10 border-t border-border/60 pt-7 sm:mt-12 sm:pt-9">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                What&apos;s inside
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                Included products
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Quantities shown are included in one kit.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kit.components.map((item, index) => (
              <div
                key={`${item.productId ?? item.name}-${index}`}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3"
              >
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <Package className="size-6 text-primary/40" strokeWidth={1.4} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">
                    {item.productId ? (
                      <Link to={`/products/${item.slug}`} className="hover:text-primary">
                        {item.name}
                      </Link>
                    ) : (
                      item.name
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.packSize ? `${item.packSize} · ` : ""}
                    <span className={item.inStock ? "text-emerald-700" : "text-destructive"}>
                      {item.inStock ? "In stock" : "Out of stock"}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  × {item.quantity}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-9">
          <Button variant="outline" className="h-10 rounded-full" onClick={() => navigate("/health-kits")}>
            <ArrowLeft className="size-4" /> Back to Health Kits
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
