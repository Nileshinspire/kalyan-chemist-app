import { memo, useCallback } from "react";
import { useNavigate, useLocation, type NavigateFunction } from "react-router";
import { beginProductTransition } from "@/lib/product-transition";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Pill, Star, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { productDiscountPercent } from "@/lib/discount";
import { preloadProductDetail } from "@/lib/route-preload";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { motion, type Variants } from "framer-motion";

function goProduct(navigate: NavigateFunction, currentPath: string, slug: string) {
  beginProductTransition();
  navigate(`/products/${slug}`, { state: { from: currentPath } });
}

function isAuthError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "message" in error && typeof (error as any).message === "string" && /not authenticated/i.test(String((error as any).message));
}

interface ProductCardProps {
  product: {
    _id: string;
    name: string;
    slug: string;
    price: number;
    discountPrice?: number;
    manufacturer: string;
    dosage?: string;
    strength?: string;
    form?: string;
    packSize: string;
    prescriptionRequired: boolean;
    stockQuantity: number;
    isActive: boolean;
    categoryName?: string;
    brandName?: string | null;
    imageUrl?: string;
  };
  newArrival?: boolean;
}

/* ─── The one product card ───
 * Information hierarchy follows the Apollo Pharmacy reference card, top-down:
 *
 *   1. media      near-square white packshot field, `object-contain` so the
 *                 product keeps its aspect ratio and is never cropped
 *   2. rating     real average + review count, green pill on the media's
 *                 bottom-left, straddling its edge
 *   3. add        compact `Add` control on the price row, bottom-right of
 *                 the card, aligned horizontally with the price
 *   4. attributes one compact pack/form line under the media, saved data only
 *   5. name       two clamped lines, then the manufacturer, one clamped line
 *   6. delivery   the store's own admin-configured estimate, when set
 *   7. price      struck-through MRP + the single discount percentage, then
 *                 the effective selling price
 *
 * The discount percentage is rendered in exactly ONE place (the price block).
 * There is no discount badge on or over the media in any product card.
 *
 * The box is pinned with `min-h-[var(--kc-card-h)]` and the price block is
 * anchored to the bottom, so two cards side by side stay identical. Phones
 * keep the full-bleed square media and their own Buy Now / Cart row.
 */

function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-center object-contain p-2.5 sm:p-1.5"
    />
  );
}

/***
 * The real review summary for one product, rendered as the compact reference
 * badge (★ 4.3 (12)). It reads the existing `reviews.getAverageRating` query —
 * the same one the product page uses — so the figure on a card is the average
 * of that product's saved reviews and their count. With no saved reviews it
 * renders nothing at all: no placeholder stars, no zero counts.
 *
 * Exported so the homepage's Hot Sellers strip, which has its own card markup,
 * shows the identical treatment from the same data.
 */
export function ProductRatingBadge({
  productId,
  className = "",
}: {
  productId: string;
  className?: string;
}) {
  const summary = useQuery(api.reviews.getAverageRating, {
    productId: productId as any,
  });
  // Nothing renderable unless the review data actually carries a positive
  // average and a positive count — never a placeholder for absent data.
  if (
    !summary ||
    !Number.isFinite(summary.average) ||
    !Number.isFinite(summary.count) ||
    summary.average <= 0 ||
    summary.count <= 0
  )
    return null;
  return (
    <span
      title={`${summary.count} ${summary.count === 1 ? "review" : "reviews"}`}
      aria-label={`Rated ${summary.average.toFixed(1)} out of 5 by ${summary.count} ${summary.count === 1 ? "review" : "reviews"}`}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] leading-3 font-semibold text-white shadow-sm ${className}`}
    >
      <Star className="size-2.5 fill-white text-white" aria-hidden />
      {summary.average.toFixed(1)}
      <span className="font-normal text-white/85">({summary.count})</span>
    </span>
  );
}

const ProductCard = memo(function ProductCard({ product, newArrival = false }: ProductCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const convexClient = useConvex();
  const realImage =
    product.imageUrl && product.imageUrl !== "/placeholder-medicine.svg"
      ? product.imageUrl
      : undefined;
  const addToCart = useMutation(api.cart.addItem);
  const toggleWishlist = useMutation(api.wishlist.toggle);
  // Store-wide estimate set by the admin in delivery settings. Every card
  // shares this one query; nothing is invented and nothing renders when the
  // setting is empty.
  const deliveryConfig = useQuery(api.deliveryConfig.getPublic);
  const deliveryEstimate = deliveryConfig?.estimatedDeliveryTime?.trim() || null;
  const isWishlisted = useQuery(
    api.wishlist.isWishlisted,
    user ? { productId: product._id as any } : "skip"
  );
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice < product.price);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const signInUrl = `/auth?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`;
    if (!user) {
      toast.error("Please sign in to add items to cart");
      navigate(signInUrl);
      return;
    }
    try {
      await addToCart({ productId: product._id as any, quantity: 1 });
      toast.success(`${product.name} added to cart`);
    } catch (error: any) {
      if (isAuthError(error)) {
        toast.error("Please sign in to add items to cart");
        navigate(signInUrl);
      } else {
        toast.error(error.message || "Failed to add to cart");
      }
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to buy now");
      navigate(`/auth?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`);
      return;
    }
    goProduct(navigate, location.pathname + location.search, product.slug);
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleWishlist({ productId: product._id as any });
    } catch (error: any) {
      if (isAuthError(error)) {
        toast.error("Please sign in to use wishlist");
      } else {
        toast.error(error.message || "Failed to update wishlist");
      }
    }
  };

  // The badge and the homepage discount section read the same function, so the
  // percentage a customer sees is exactly the percentage the section matches on.
  const discountPct = productDiscountPercent(product.price, product.discountPrice);

  // One compact attribute line, exactly like the reference's
  // "150 ml Spray · Bottle": the saved pack size, then the saved packaging
  // form. Fields that are blank or recorded as "N/A" are omitted, and nothing
  // is inferred.
  const attributeLine = [product.packSize, product.form]
    .filter((value): value is string => Boolean(value && value.trim()))
    .filter((value) => !/^n\/?a$/i.test(value.trim()))
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" · ");
  const isLowStock = product.stockQuantity > 0 && product.stockQuantity < 10;

  // Keep the existing hover behaviour but also add explicit pointer leaves.
  const warmProductDetail = useCallback(() => {
    preloadProductDetail();
    convexClient.prewarmQuery({ query: api.products.getBySlug, args: { slug: product.slug } });
  }, [convexClient, product.slug]);

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      data-slot="card"
      className={`group relative flex flex-col overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:-translate-y-1 max-sm:rounded-[10px] max-sm:border max-sm:border-border/40 max-sm:bg-white max-sm:shadow-sm ${product.stockQuantity === 0 ? "max-sm:opacity-70" : ""} sm:rounded-2xl sm:border sm:border-border/70 sm:bg-card sm:min-h-[var(--kc-card-h)] sm:p-4 sm:shadow-sm`}
      onPointerEnter={warmProductDetail}
      onPointerLeave={warmProductDetail}
      onMouseEnter={warmProductDetail}
      onFocus={warmProductDetail}
      onPointerDown={warmProductDetail}
      onClick={() => goProduct(navigate, location.pathname + location.search, product.slug)}
    >
      {/* Wishlist heart — only on desktop (hidden on mobile compact card). */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white hover:scale-110 transition-all duration-300 opacity-100 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100 sm:block max-sm:hidden"
        onClick={handleWishlist}
      >
        <Heart className={`size-3 transition-colors ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground group-hover:text-rose-500"}`} />
      </Button>

      <div className="flex flex-col gap-1.5">
        {/* Image — compact square-ish picture with subtle rounded border,
          rating pill on its bottom-left and an outlined Add button on its
          bottom-right overlapping the lower edge (exactly like Apollo). */}
      <div className="relative shrink-0 rounded-xl border border-border/60 overflow-hidden">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[10px] bg-white">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {realImage ? (
            <ProductImage src={realImage} alt={product.name} />
          ) : (
            <Pill
              className="size-10 text-primary/20 transition-all duration-500 group-hover:scale-125 group-hover:text-primary/35 group-hover:rotate-6"
            />
          )}
          {newArrival && (
            <div className="absolute top-1.5 left-1.5 z-[1]">
              <Badge className="text-[9px] font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-0 shadow-sm">
                New
              </Badge>
            </div>
          )}
          {product.prescriptionRequired && (
            <div className={`absolute left-1.5 z-[1] ${newArrival ? "top-6" : "top-1.5"}`}>
              <Badge variant="secondary" className="text-[9px] font-medium bg-red-50 text-red-700 border-red-200">
                Rx
              </Badge>
            </div>
          )}
        </div>

        {/* Rating pill on the image's bottom-left edge. */}
        <div className="pointer-events-none absolute bottom-0.5 left-1 z-[1]">
          <ProductRatingBadge productId={product._id} />
        </div>

        {/* Compact outlined Add button on the image's bottom-right, overlapping
            the lower edge — Apollo style. */}
        <div className="pointer-events-none absolute right-0.5 bottom-0.5 z-[2]">
          <button
            type="button"
            aria-label={product.stockQuantity === 0 ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
            className={`h-7 w-[48px] rounded border border-emerald-700 bg-white px-0 text-center text-[10px] font-semibold text-emerald-700 shadow-sm transition-all duration-300 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 active:scale-95 ${product.stockQuantity === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
            onClick={handleAddToCart}
            disabled={product.stockQuantity === 0}
          >
            {product.stockQuantity === 0 ? "Sold out" : "Add"}
          </button>
        </div>
      </div>

        {/* Compact product details directly below the image, no outer card border. */}
        <div className="flex flex-col gap-0.5">
          {/* Compact grey quantity/size labels (e.g. "650 ml Shampoo · Bottle"). */}
          {attributeLine && (
            <p className="truncate text-[10px] leading-3 text-muted-foreground sm:text-[11px]">
              {attributeLine}
            </p>
          )}

          {/* Product name — two-line clamp. */}
          <h3 className="line-clamp-2 min-h-0 text-[12px] leading-snug font-semibold text-foreground sm:text-sm sm:leading-5">
            {product.name}
          </h3>

          {/* Brand name, compact, grey. */}
          <p className="truncate text-[10px] leading-3 text-muted-foreground sm:text-xs sm:leading-4">
            {product.manufacturer}
          </p>

          {/* Price block: MRP strikethrough + green discount %, then selling price
              with compact unit-price suffix when available. */}
          <div className="flex flex-col gap-0.5">
            {hasDiscount && (
              <div className="flex items-baseline gap-x-1 text-[10px] leading-3 text-muted-foreground sm:flex-wrap sm:items-baseline sm:gap-x-1.5 sm:text-[11px]">
                <span>MRP</span>
                <span className="line-through">{formatCurrency(product.price)}</span>
                {discountPct > 0 && (
                  <span data-slot="discount-pct" className="font-semibold text-emerald-700">
                    {discountPct}% off
                  </span>
                )}
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <div className="min-w-0 text-base leading-6 font-extrabold text-foreground">
                {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
              </div>
              {/* Compact unit-price suffix, Apollo-style, only when packSize has a number. */}
              {product.price > 0 && hasDiscount && product.discountPrice && product.packSize && Number.isFinite(Number(product.packSize.match(/\d+/)?.[0])) && (
                <span className="text-[9px] font-normal text-muted-foreground ml-0.5">
                  ({formatCurrency(product.discountPrice! / Number(product.packSize.match(/\d+/)?.[0]))})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop-only card content (sm+) — unchanged bordered card ───
          * Only renders on desktop/tablet so the compact mobile card above
          * is the only thing phones see. Keeps the existing image-on-top,
          * Buy Now / Cart row layout, border, hover effect exactly as before. */}
      <div className="hidden sm:block">
        <div data-slot="card-content" className="flex flex-1 flex-col p-4">
          <div className="flex flex-1 flex-col">
            {attributeLine && (
              <p className="mt-5 truncate text-[11px] leading-4 text-muted-foreground sm:mt-6">
                {attributeLine}
              </p>
            )}

            <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-tight font-semibold text-foreground transition-colors duration-300 group-hover:text-primary sm:text-sm sm:leading-5">
              {product.name}
            </h3>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-4">
              {product.manufacturer}
            </p>

            {(deliveryEstimate || isLowStock) && (
              <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] leading-3 text-muted-foreground sm:text-[11px]">
                {deliveryEstimate && (
                  <>
                    <Truck className="size-3 shrink-0 text-primary/80" aria-hidden />
                    <span className="min-w-0 truncate">Delivery: {deliveryEstimate}</span>
                  </>
                )}
                {isLowStock && (
                  <span className={`shrink-0 font-medium text-amber-600 ${deliveryEstimate ? "ml-auto" : ""}`}>
                    Only {product.stockQuantity} left
                  </span>
                )}
              </p>
            )}

            <div className="mt-auto pt-2">
              {hasDiscount && (
                <div className="flex flex-wrap items-baseline gap-x-1.5 text-[10px] leading-3 text-muted-foreground sm:text-[11px]">
                  <span>MRP</span>
                  <span className="line-through">{formatCurrency(product.price)}</span>
                  {discountPct > 0 && (
                    <span data-slot="discount-pct" className="font-semibold text-emerald-700">
                      {discountPct}% off
                    </span>
                  )}
                </div>
              )}
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <div className="min-w-0 text-base leading-6 font-extrabold text-foreground">
                  {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
                </div>
                <div className="shrink-0">
                  <Button
                    size="sm"
                    aria-label={product.stockQuantity === 0 ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
                    className={`h-8 w-[58px] rounded-lg px-1 text-[11px] font-semibold gradient-primary text-white shadow-sm transition-all duration-300 hover:shadow-glow hover:scale-[1.03] active:scale-[0.97] ${product.stockQuantity === 0 ? "text-[8px]" : ""}`}
                    onClick={handleAddToCart}
                    disabled={product.stockQuantity === 0}
                  >
                    {product.stockQuantity === 0 ? "Sold out" : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap pt-2">
            <Button
              size="sm"
              className="h-8 min-h-8 px-2 text-xs font-semibold gap-0.5 gradient-primary text-white shadow-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleBuyNow}
              disabled={product.stockQuantity === 0}
            >
              {product.stockQuantity === 0 ? "Out of Stock" : "Buy Now"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="px-2 text-xs font-semibold gap-0.5 border border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-300"
              onClick={handleAddToCart}
              disabled={product.stockQuantity === 0}
            >
              Cart
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;
