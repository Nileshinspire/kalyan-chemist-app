import { memo, useCallback } from "react";
import { useNavigate, useLocation, type NavigateFunction } from "react-router";
import { beginProductTransition } from "@/lib/product-transition";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Pill, Star, Clock, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { productDiscountPercent } from "@/lib/discount";
import { preloadProductDetail } from "@/lib/route-preload";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { motion, type Variants } from "framer-motion";
import { StockAlertButton } from "@/components/product/StockAlertButton";

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
 * One responsive structure for both phone and desktop, top-down:
 *
 *   1. media      packshot field, `object-contain` so the product keeps its
 *                 aspect ratio and is never cropped
 *   2. rating     the product's real average + review count, badge on the
 *                 media's TOP-LEFT; nothing renders when it has no reviews
 *   3. wishlist   the existing wishlist toggle, icon on the media's TOP-RIGHT
 *   4. attributes one compact pack/form line under the media, saved data only
 *   5. name       two clamped lines, then the manufacturer, one clamped line
 *   6. price      struck-through MRP + the single discount percentage, then
 *                 the effective selling price
 *   7. delivery   the store's own admin-configured estimate with a clock icon,
 *                 on a reserved line so every card keeps the same rhythm
 *   8. action     ONE main `Add to Cart`, or `Notify Me` when out of stock, so
 *                 every card in a row shares the same button baseline
 *
 * The discount percentage is rendered in exactly ONE place (the price block).
 * There is no discount badge on or over the media in any product card, and no
 * duplicate `Add` control on the image.
 */

function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-center object-contain p-2 sm:p-1.5"
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

/***
 * The existing wishlist toggle as the card's compact Save icon. It drives the
 * same `wishlist.toggle` / `wishlist.isWishlisted` API the account Wishlist
 * page uses — no separate list, no separate records.
 *
 * Exported so the homepage's Hot Sellers strip renders the identical control.
 */
export function ProductWishlistButton({
  productId,
  productName,
  className = "",
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const { user } = useAuth();
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const isWishlisted = useQuery(
    api.wishlist.isWishlisted,
    user ? { productId: productId as any } : "skip"
  );

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleWishlist({ productId: productId as any });
    } catch (error: any) {
      if (isAuthError(error)) {
        toast.error("Please sign in to use wishlist");
      } else {
        toast.error(error.message || "Failed to update wishlist");
      }
    }
  };

  return (
    <button
      type="button"
      aria-label={isWishlisted ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      aria-pressed={Boolean(isWishlisted)}
      data-slot="wishlist-toggle"
      onClick={handle}
      className={`flex size-6 items-center justify-center rounded-full border border-border/60 bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white ${className}`}
    >
      <Heart
        className={`size-3.5 transition-colors ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
      />
    </button>
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
  // Store-wide estimate set by the admin in delivery settings. Every card
  // shares this one query; nothing is invented and nothing renders when the
  // setting is empty.
  const deliveryConfig = useQuery(api.deliveryConfig.getPublic);
  const deliveryEstimate = deliveryConfig?.estimatedDeliveryTime?.trim() || null;
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice < product.price);
  const isOutOfStock = product.stockQuantity === 0;

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
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1 max-sm:rounded-[10px] max-sm:border-border/40 max-sm:bg-white max-sm:shadow-sm sm:min-h-[var(--kc-card-h)] sm:p-3.5"
      onPointerEnter={warmProductDetail}
      onPointerLeave={warmProductDetail}
      onMouseEnter={warmProductDetail}
      onFocus={warmProductDetail}
      onPointerDown={warmProductDetail}
      onClick={() => goProduct(navigate, location.pathname + location.search, product.slug)}
    >
      {/* Media — the packshot keeps its aspect ratio; the rating badge sits on
          its top-left and the wishlist Save icon on its top-right. */}
      <div className="relative shrink-0 overflow-hidden rounded-xl border border-border/50 bg-white">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {realImage ? (
            <ProductImage src={realImage} alt={product.name} />
          ) : (
            <Pill className="size-10 text-primary/20 transition-all duration-500 group-hover:scale-125 group-hover:text-primary/35 group-hover:rotate-6" />
          )}
          {newArrival && (
            <div className="absolute bottom-1.5 right-1.5 z-[1]">
              <Badge className="text-[9px] font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-0 shadow-sm">
                New
              </Badge>
            </div>
          )}
          {product.prescriptionRequired && (
            <div className={`absolute z-[1] ${newArrival ? "bottom-6" : "bottom-1.5"} right-1.5`}>
              <Badge variant="secondary" className="text-[9px] font-medium bg-red-50 text-red-700 border-red-200">
                Rx
              </Badge>
            </div>
          )}

          {/* Real customer rating — top-left of the image. */}
          <div className="absolute left-1.5 top-1.5 z-[2]">
            <ProductRatingBadge productId={product._id} />
          </div>

          {/* Existing wishlist toggle — top-right of the image. */}
          <div className="absolute right-1.5 top-1.5 z-[2]">
            <ProductWishlistButton productId={product._id} productName={product.name} />
          </div>
        </div>
      </div>

      {/* Details — one flex column so every card keeps the same rhythm and the
          action button always lands on the same baseline. */}
      <div className="flex flex-1 flex-col pt-1.5 sm:pt-2">
        {/* Pack/packaging attributes — saved fields only. */}
        <p className="truncate text-[10px] leading-3 text-muted-foreground sm:text-[11px] sm:leading-4">
          {attributeLine}
        </p>

        {/* Name — two clamped lines, always the same height. */}
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.2rem] text-[12px] leading-snug font-semibold text-foreground transition-colors duration-300 group-hover:text-primary sm:text-sm sm:leading-5">
          {product.name}
        </h3>

        <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground sm:text-xs sm:leading-4">
          {product.manufacturer}
        </p>

        {/* Price hierarchy: struck-through MRP with the single discount
            percentage, then the effective selling price. */}
        <div className="mt-1">
          {hasDiscount && (
            <div className="flex flex-wrap items-baseline gap-x-1 text-[10px] leading-3 text-muted-foreground sm:gap-x-1.5 sm:text-[11px]">
              <span>MRP</span>
              <span className="line-through">{formatCurrency(product.price)}</span>
              {discountPct > 0 && (
                <span data-slot="discount-pct" className="font-semibold text-emerald-700">
                  {discountPct}% off
                </span>
              )}
            </div>
          )}
          <div className="mt-0.5 flex items-baseline gap-1">
            <div className="min-w-0 text-base leading-6 font-extrabold text-foreground">
              {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
            </div>
          </div>
        </div>

        {/* Delivery estimate — the store's own admin-configured value, with a
            clock icon, on a reserved line so every card matches. Nothing is
            invented when no estimate is configured. */}
        <div className="mt-1 flex min-h-[14px] min-w-0 items-center gap-1 text-[10px] leading-3 text-muted-foreground sm:text-[11px]">
          {deliveryEstimate && (
            <>
              <Clock className="size-3 shrink-0 text-primary/80" aria-hidden />
              <span className="min-w-0 truncate">Delivery: {deliveryEstimate}</span>
            </>
          )}
          {isLowStock && (
            <span className={`shrink-0 font-medium text-amber-600 ${deliveryEstimate ? "ml-auto" : ""}`}>
              Only {product.stockQuantity} left
            </span>
          )}
        </div>

        {/* Action area — ONE main button per card, pinned to the bottom so all
            buttons in a row share the same baseline. Out of stock swaps the
            Add to Cart button for the existing Notify Me control. */}
        <div className="mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
          {isOutOfStock ? (
            <StockAlertButton productId={product._id as any} productName={product.name} compact />
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                aria-label={`Add ${product.name} to cart`}
                className="h-9 min-h-9 flex-1 gap-1 rounded-lg px-2 text-[11px] font-semibold gradient-primary text-white shadow-sm transition-all duration-300 hover:shadow-glow active:scale-[0.98] sm:text-xs"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="size-3.5 shrink-0 max-sm:hidden" aria-hidden />
                <span className="truncate">Add to Cart</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Buy ${product.name} now`}
                className="hidden h-9 shrink-0 rounded-lg border-border/60 px-2 text-[11px] font-semibold hover:border-primary/30 hover:bg-primary/[0.03] sm:inline-flex"
                onClick={handleBuyNow}
              >
                Buy Now
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;
