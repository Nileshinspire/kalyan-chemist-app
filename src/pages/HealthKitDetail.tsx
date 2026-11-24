import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/auth-utils";
import { stagePendingCartLine } from "@/lib/pending-cart";
import {
  buildCustomKitQuote,
  serializeKitSelection,
} from "@/lib/healthKitQuote";

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /not authenticated|unauthenticated|sign.?in|unauthorized/i.test(message);
}

function RatingStars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-3.5 ${
            star <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

export default function HealthKitDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const kit = useQuery(api.healthKits.getBySlug, slug ? { slug } : "skip");
  const reviews = useQuery(
    api.reviews.listByProduct,
    kit ? { productId: kit._id } : "skip",
  );
  const rating = useQuery(
    api.reviews.getAverageRating,
    kit ? { productId: kit._id } : "skip",
  );
  const wishlisted = useQuery(
    api.wishlist.isWishlisted,
    kit ? { productId: kit._id } : "skip",
  );
  const addToCart = useMutation(api.cart.addItem);
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const deliveryConfig = useQuery(api.deliveryConfig.getPublic);

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [wishlisting, setWishlisting] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [pincode, setPincode] = useState("");
  const [selection, setSelection] = useState<Record<string, number> | null>(null);

  const pincodeCheck = useQuery(
    api.deliveryConfig.checkPincode,
    pincode.trim().length === 6 ? { pincode: pincode.trim() } : "skip",
  );

  useEffect(() => {
    setQuantity(1);
    setActiveImage(0);
    setSelection(null);
    setPincode("");
  }, [slug]);

  const quote = useMemo(() => {
    if (!kit) return null;
    return buildCustomKitQuote({
      components: kit.components.map((item) => ({
        productId: item.productId,
        name: item.name,
        slug: item.slug,
        imageUrl: item.imageUrl,
        packSize: item.packSize,
        manufacturer: item.manufacturer,
        configuredQuantity: item.quantity,
        mrp: item.mrp,
        effectiveUnitPrice: item.effectiveUnitPrice,
        stockQuantity: item.stockQuantity,
        isActive: item.isActive,
        expiryDate: item.expiryDate,
      })),
      basePrice: kit.sellingPrice,
      selection: selection
        ? kit.components.map((item) => ({
            productId: item.productId,
            quantity: Math.max(
              0,
              Math.min(item.quantity, selection[item.productId] ?? item.quantity),
            ),
          }))
        : undefined,
      baseCatalogueMrp: kit.mrp,
      baseEffectiveCatalogueValue: kit.effectiveCatalogueValue,
    });
  }, [kit, selection]);

  const maxKits = quote?.available ? Math.max(1, quote.maxQuantity) : 1;
  const effectiveQuantity = Math.min(Math.max(1, quantity), maxKits);

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

  if (!quote) return null;

  const selectedProductCount = quote.selectedProductCount;
  const isCustomized = quote.isCustomized;
  const quantityOf = (productId: string, configured: number) =>
    Math.max(0, Math.min(configured, selection?.[productId] ?? configured));

  const setComponentQuantity = (productId: string, configured: number, next: number) => {
    setSelection((current) => {
      const base =
        current ??
        Object.fromEntries(kit.components.map((item) => [item.productId, item.quantity]));
      return {
        ...base,
        [productId]: Math.max(0, Math.min(configured, Math.round(next))),
      };
    });
  };

  const restoreAll = () => setSelection(null);

  const signInUrl = `/auth?returnTo=${encodeURIComponent(`/health-kits/${kit.slug}`)}`;

  const handleAdd = async () => {
    if (!quote.available) return;
    if (!user) {
      stagePendingCartLine(
        kit._id,
        effectiveQuantity,
        isCustomized
          ? quote.selection.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            }))
          : undefined,
      );
      toast.success(`${kit.name} saved — sign in to add it to your cart`);
      navigate(signInUrl);
      return;
    }
    setAdding(true);
    try {
      await addToCart({
        productId: kit._id as any,
        quantity: effectiveQuantity,
        ...(isCustomized
          ? {
              kitSelection: quote.selection.map((line) => ({
                productId: line.productId as any,
                quantity: line.quantity,
              })),
            }
          : {}),
      });
      toast.success(
        isCustomized
          ? `${kit.name} (customized) added to cart`
          : `${kit.name} added to cart`,
      );
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

  const handleBuyNow = () => {
    if (!quote.available) return;
    setBuying(true);
    const selectionParam = isCustomized
      ? serializeKitSelection(quote.selection)
      : "";
    const checkoutPath = `/checkout?buyNow=${kit._id}&qty=${effectiveQuantity}${
      selectionParam ? `&kitSelection=${encodeURIComponent(selectionParam)}` : ""
    }`;
    if (!user) {
      navigate(`/auth?returnTo=${encodeURIComponent(checkoutPath)}`);
      return;
    }
    navigate(checkoutPath);
  };

  const handleWishlist = async () => {
    if (!user) {
      navigate(signInUrl);
      return;
    }
    setWishlisting(true);
    try {
      const result = await toggleWishlist({ productId: kit._id as any });
      toast.success(result.wishlisted ? "Saved to wishlist" : "Removed from wishlist");
    } catch (error: any) {
      toast.error(error?.message || "Could not update your wishlist");
    } finally {
      setWishlisting(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = {
      title: `${kit.name} · Kalyan Chemist`,
      text: kit.description,
      url,
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Kit link copied");
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Kit link copied");
      } catch {
        toast.error("Could not share this kit");
      }
    }
  };

  const reviewCount = rating?.count ?? 0;
  const averageRating = rating?.average ?? 0;
  const available = quote.available;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">Home</Link>
          <ChevronRight className="size-3" />
          <Link to="/health-kits" className="hover:text-primary">Health Kits</Link>
          <ChevronRight className="size-3" />
          <span className="max-w-[55vw] truncate text-foreground">{kit.name}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-10">
          {/* Gallery */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="min-w-0 lg:sticky lg:top-24 lg:self-start"
          >
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-white">
              <div className="flex aspect-[4/3] items-center justify-center p-5 sm:p-8 lg:aspect-square">
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
                  available ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"
                }`}
              >
                <span className={`size-1.5 rounded-full ${available ? "bg-emerald-500" : "bg-destructive"}`} />
                {available
                  ? `${quote.maxQuantity} customized kit${quote.maxQuantity === 1 ? "" : "s"} available`
                  : "This configuration is unavailable"}
              </span>
              {reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <RatingStars value={averageRating} /> {averageRating.toFixed(1)} ({reviewCount})
                </span>
              )}
            </div>

            <div className="mt-2 flex items-start justify-between gap-3">
              <h1 className="min-w-0 font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {kit.name}
              </h1>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 rounded-full border-border/70"
                  onClick={handleWishlist}
                  disabled={wishlisting}
                  aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
                >
                  {wishlisting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Heart className={`size-4 ${wishlisted ? "fill-destructive text-destructive" : ""}`} />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 rounded-full border-border/70"
                  onClick={handleShare}
                  aria-label="Share this kit"
                >
                  <Share2 className="size-4" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              {kit.description}
            </p>

            <div className="mt-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-3xl font-bold tracking-tight">
                  {formatCurrency(quote.customizedPrice)}
                </span>
                {(isCustomized || quote.savings > 0) && (
                  <span className="pb-1 text-sm text-muted-foreground line-through">
                    {formatCurrency(isCustomized ? quote.basePrice : quote.selectedMrp)}
                  </span>
                )}
                {quote.savings > 0 && (
                  <span className="mb-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    Save {formatCurrency(quote.savings)}
                    {quote.selectedMrp > 0
                      ? ` · ${Math.round((quote.savings / quote.selectedMrp) * 100)}% off`
                      : ""}
                  </span>
                )}
                {isCustomized && (
                  <Badge className="mb-1 rounded-full bg-primary/10 text-[10px] font-semibold text-primary hover:bg-primary/10">
                    Customized
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {isCustomized
                  ? `Original kit ${formatCurrency(quote.basePrice)} · your customized price is ${formatCurrency(quote.customizedPrice)}. Each removed product deducts its proportional share of the kit price.`
                  : "Inclusive of current product discounts. Taxes and delivery are calculated at checkout."}
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex h-11 w-fit items-center rounded-full border border-border/80 bg-background">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, Math.min(value, maxKits) - 1))}
                    disabled={effectiveQuantity <= 1 || !available}
                    className="flex h-full w-10 items-center justify-center rounded-l-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{effectiveQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(maxKits, Math.min(value, maxKits) + 1))}
                    disabled={effectiveQuantity >= maxKits || !available}
                    className="flex h-full w-10 items-center justify-center rounded-r-full text-muted-foreground hover:text-foreground disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="grid flex-1 grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <Button
                    size="lg"
                    disabled={!available || adding}
                    onClick={handleAdd}
                    className="h-11 rounded-full text-sm font-semibold"
                  >
                    {adding ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                    {adding ? "Adding…" : "Add to Cart"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={!available || buying}
                    onClick={handleBuyNow}
                    className="h-11 rounded-full border-primary/40 text-sm font-semibold text-primary hover:bg-primary/5"
                  >
                    {buying ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    Buy Now
                  </Button>
                </div>
              </div>
              {!available && quote.unavailableReason && (
                <p className="mt-2 text-xs font-medium text-destructive">{quote.unavailableReason}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Truck className="size-3.5" /> {deliveryConfig?.estimatedDeliveryTime || "Delivery options at checkout"}</span>
                <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Genuine catalogue products</span>
                <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> One cart &amp; checkout</span>
              </div>
            </div>

            {/* Delivery estimate */}
            <div className="mt-3 rounded-xl border border-border/70 bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-primary" />
                <p className="text-xs font-semibold">Check delivery to your pincode</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  value={pincode}
                  onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  className="h-9 max-w-[180px] text-sm"
                />
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock3 className="size-3" />
                  {pincode.length === 6
                    ? pincodeCheck === undefined
                      ? "Checking…"
                      : pincodeCheck?.available
                        ? pincodeCheck.estimatedDeliveryTime || "Delivery available"
                        : pincodeCheck?.reason || "Not serviceable"
                    : "Enter your pincode"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Products</p>
                <p className="mt-0.5 font-semibold">{selectedProductCount}/{quote.configuredProductCount}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total units</p>
                <p className="mt-0.5 font-semibold">{quote.totalUnits}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Available kits</p>
                <p className="mt-0.5 font-semibold">{available ? quote.maxQuantity : "—"}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Customizable contents */}
        <section className="mt-9 border-t border-border/60 pt-7 sm:mt-12 sm:pt-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                Build your kit
              </p>
              <h2 className="mt-1 flex flex-wrap items-center gap-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                Included products
                {isCustomized && (
                  <Badge className="rounded-full bg-primary/10 text-[10px] font-semibold text-primary hover:bg-primary/10">
                    Customized
                  </Badge>
                )}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isCustomized && (
                <Button variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={restoreAll}>
                  <RotateCcw className="size-3.5" /> Restore original kit
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Remove items or adjust quantities. The price updates instantly.
              </p>
            </div>
          </div>

          {isCustomized && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] px-3.5 py-2.5 text-xs">
              <p className="font-semibold text-primary">
                Customized kit · {selectedProductCount} of {quote.configuredProductCount} products · {quote.totalUnits} units
              </p>
              {quote.removedProductCount > 0 && (
                <p className="text-muted-foreground">
                  {quote.removedProductCount} removed · {formatCurrency(quote.removedFromBasePrice)} adjusted off
                </p>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quote.components.map((item) => {
              const configured = item.configuredQuantity;
              const selected = quantityOf(item.productId, configured);
              const maxSelectable = Math.min(configured, Math.max(0, item.stockQuantity));
              const removed = selected === 0;
              return (
                <div
                  key={item.productId}
                  className={`flex min-w-0 flex-col rounded-2xl border bg-card p-3 transition-colors ${
                    removed ? "border-dashed border-border/70 opacity-75" : "border-border/70"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
                      ) : (
                        <Package className="size-6 text-primary/40" strokeWidth={1.4} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">
                        {item.slug ? (
                          <Link to={`/products/${item.slug}`} className="hover:text-primary">
                            {item.name}
                          </Link>
                        ) : (
                          item.name
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.packSize ? `${item.packSize} · ` : ""}
                        <span className={item.stockQuantity > 0 ? "text-emerald-700" : "text-destructive"}>
                          {item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : "Out of stock"}
                        </span>
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Kit includes × {configured}
                        {item.expiryDate ? ` · Expires ${new Date(item.expiryDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {removed ? "Removed" : "In your kit"}
                      </p>
                      <p className="text-xs font-semibold">
                        {removed ? "—" : `${formatCurrency(item.allocatedPrice)} kit share`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!removed && (
                        <div className="flex h-8 items-center rounded-full border bg-background">
                          <button
                            type="button"
                            onClick={() => setComponentQuantity(item.productId, configured, selected - 1)}
                            className="flex h-full w-7 items-center justify-center rounded-l-full text-muted-foreground hover:text-foreground"
                            aria-label={`Remove one ${item.name}`}
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-5 text-center text-[11px] font-bold">{selected}</span>
                          <button
                            type="button"
                            onClick={() => setComponentQuantity(item.productId, configured, selected + 1)}
                            disabled={selected >= maxSelectable}
                            className="flex h-full w-7 items-center justify-center rounded-r-full text-muted-foreground hover:text-foreground disabled:opacity-30"
                            aria-label={`Add one ${item.name}`}
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant={removed ? "outline" : "ghost"}
                        size="sm"
                        className={`h-8 rounded-full px-2.5 text-[11px] ${
                          removed
                            ? "border-primary/30 text-primary hover:bg-primary/5"
                            : "text-destructive hover:text-destructive"
                        }`}
                        onClick={() =>
                          setComponentQuantity(item.productId, configured, removed ? configured : 0)
                        }
                      >
                        {removed ? <RotateCcw className="size-3" /> : <Trash2 className="size-3" />}
                        {removed ? "Restore" : "Remove"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
            <div>
              <p className="text-sm font-semibold">
                {isCustomized ? "Your customized kit" : "Original kit"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {quote.selectedProductCount} products · {quote.totalUnits} total units
                {isCustomized ? ` · original ${formatCurrency(quote.basePrice)}` : ""}
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              {isCustomized && (
                <span className="text-xs text-muted-foreground line-through">{formatCurrency(quote.basePrice)}</span>
              )}
              <span className="text-xl font-bold">{formatCurrency(quote.customizedPrice)}</span>
              {quote.savings > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700">
                  save {formatCurrency(quote.savings)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-9 border-t border-border/60 pt-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                Customer feedback
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight">
                Ratings &amp; reviews
              </h2>
            </div>
            {reviewCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <RatingStars value={averageRating} />
                <span className="font-semibold">{averageRating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">from {reviewCount} review{reviewCount === 1 ? "" : "s"}</span>
              </div>
            )}
          </div>

          {reviews === undefined ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>
          ) : reviews.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
              No customer reviews yet. Reviews from verified customers will appear here.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 6).map((review: any) => (
                <div key={review._id} className="rounded-xl border border-border/70 bg-card p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {review.userInitial}
                      </div>
                      <p className="truncate text-xs font-semibold">{review.userName}</p>
                    </div>
                    <RatingStars value={review.rating} />
                  </div>
                  <p className="mt-2 text-xs font-semibold">{review.title}</p>
                  <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground">{review.body}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          )}
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
