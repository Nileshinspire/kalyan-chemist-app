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
 *   1. wishlist   the existing wishlist toggle in its own reserved strip at the
 *                 card's TOP-RIGHT, above the packshot — never on the photo
 *   2. media      the packshot plate; the photo fills it edge to edge with
 *                 `object-contain`, so it keeps its aspect ratio and is never
 *                 cropped or stretched
 *   3. attributes one compact pack/form line under the media, saved data only
 *   4. name row   the name in a fixed two-line box, with the product's real
 *                 average + review count beside it on the right; nothing renders
 *                 when it has no reviews
 *   5. brand      one clamped line
 *   6. price      struck-through MRP + the single discount percentage, then
 *                 the effective selling price. The MRP line is ALWAYS reserved
 *                 (empty for full-price products) so the rows below never move
 *   7. status     ONE fixed-height status line. In stock it holds the store's
 *                 own admin-configured estimate with a clock icon; out of stock
 *                 it holds the "Out of Stock" label in that same line. Both are
 *                 vertically centred in the same box, so stock status can never
 *                 move the row or the buttons below it
 *   8. action     ONE main `Add to Cart`, or the existing compact `Notify Me`
 *                 control when out of stock — same height, same baseline
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
      className="absolute inset-0 h-full w-full object-center object-contain"
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
 * Rendered in the card's name row, beside the product name.
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
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-600 px-1 py-0.5 text-[9px] leading-3 font-semibold text-white shadow-sm sm:gap-1 sm:px-1.5 sm:text-[10px] ${className}`}
    >
      <Star className="size-2 fill-white text-white sm:size-2.5" aria-hidden />
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
 * Rendered in its own reserved strip at the card's top-right, above the photo.
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
      className={`flex size-5 items-center justify-center rounded-full border border-border/60 bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white ${className}`}
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
  // Out-of-stock products don't show a delivery estimate. They fill the same
  // status row with the Out of Stock label instead (see the status row below),
  // so the row never disappears and neighbouring cards don't shift.
  const showDelivery = Boolean(deliveryEstimate) && !isOutOfStock;

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
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-1.5 cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1 max-sm:rounded-[10px] max-sm:border-border/40 max-sm:bg-white max-sm:shadow-sm sm:min-h-[var(--kc-card-h)] sm:p-3.5"
      onPointerEnter={warmProductDetail}
      onPointerLeave={warmProductDetail}
      onMouseEnter={warmProductDetail}
      onFocus={warmProductDetail}
      onPointerDown={warmProductDetail}
      onClick={() => goProduct(navigate, location.pathname + location.search, product.slug)}
    >
      {/* Card top strip — the existing wishlist toggle in its own reserved row at
          the card's top-right, so it never covers the packshot. */}
      <div className="mb-1 flex h-5 shrink-0 items-center justify-end">
        <ProductWishlistButton productId={product._id} productName={product.name} />
      </div>

      {/* Packshot plate — the photo fills it edge to edge. */}
      <div className="relative shrink-0 overflow-hidden rounded-lg border border-border/50 bg-white">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {realImage ? (
            <ProductImage src={realImage} alt={product.name} />
          ) : (
            <Pill className="size-10 text-primary/20 transition-all duration-500 group-hover:scale-125 group-hover:text-primary/35 group-hover:rotate-6" />
          )}
          {newArrival && (
            <div className="absolute bottom-1 right-1 z-[1]">
              <Badge className="text-[9px] font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-0 shadow-sm">
                New
              </Badge>
            </div>
          )}
          {product.prescriptionRequired && (
            <div className={`absolute z-[1] ${newArrival ? "bottom-5" : "bottom-1"} right-1`}>
              <Badge variant="secondary" className="text-[9px] font-medium bg-red-50 text-red-700 border-red-200">
                Rx
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Details — one flex column so every card keeps the same rhythm and the
          action button always lands on the same baseline. */}
      <div className="flex flex-1 flex-col pt-1">
        {/* Pack/packaging attributes — saved fields only, on a reserved line so
            a product without them cannot pull the rest of the card up. */}
        <p className="min-h-3 truncate text-[10px] leading-3 text-muted-foreground sm:min-h-4 sm:text-[11px] sm:leading-4">
          {attributeLine}
        </p>

        {/* Name row — the name takes the free space and the real rating badge
            sits at its right. The name is clamped in a fixed two-line box, so a
            one-line name and a two-line name occupy exactly the same space and
            a long name can never push the badge or the rows below it. */}
        <div className="mt-0.5 flex items-start gap-1.5">
          <h3 className="line-clamp-2 h-8 min-w-0 flex-1 text-[12px] leading-4 font-semibold text-foreground transition-colors duration-300 group-hover:text-primary sm:h-10 sm:text-sm sm:leading-5">
            {product.name}
          </h3>
          <ProductRatingBadge productId={product._id} className="mt-px" />
        </div>

        <p className="mt-0.5 min-h-3 truncate text-[10px] leading-3 text-muted-foreground sm:min-h-4 sm:text-xs sm:leading-4">
          {product.manufacturer}
        </p>

        {/* Price hierarchy: struck-through MRP with the single discount
            percentage, then the effective selling price. The MRP line is a
            reserved, always-present row (empty for full-price products), so a
            product WITH a discount and one WITHOUT still put the selling price
            and the delivery line on exactly the same vertical position. */}
        <div className="mt-0.5">
          <div className="flex min-h-3 flex-wrap items-baseline gap-x-1 text-[10px] leading-3 text-muted-foreground sm:min-h-4 sm:gap-x-1.5 sm:text-[11px]">
            {hasDiscount && (
              <>
                <span>MRP</span>
                <span className="line-through">{formatCurrency(product.price)}</span>
                {discountPct > 0 && (
                  <span data-slot="discount-pct" className="font-semibold text-emerald-700">
                    {discountPct}% off
                  </span>
                )}
              </>
            )}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <div className="min-w-0 text-base leading-5 font-extrabold text-foreground">
              {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
            </div>
          </div>
        </div>

        {/* Status line — ONE fixed-height row for every card. In stock it shows
            the store's own admin-configured estimate with a clock icon; out of
            stock it shows the Out of Stock label in this exact same row, never
            in a row of its own. Both are vertically centred, so the row's top
            and the buttons below it are identical in every card of a row. */}
        <div
          data-slot="status-row"
          className="mt-0.5 flex h-4 min-h-4 min-w-0 items-center gap-1 overflow-hidden text-[10px] leading-3 text-muted-foreground sm:h-[18px] sm:min-h-[18px] sm:text-[11px]"
        >
          {isOutOfStock ? (
            <span
              data-slot="out-of-stock-label"
              className="inline-flex min-w-0 shrink-0 items-center rounded-[3px] bg-rose-50 px-1.5 py-px text-[10px] leading-3 font-semibold text-rose-600 sm:text-[11px]"
            >
              Out of Stock
            </span>
          ) : (
            showDelivery && (
              <>
                <Clock className="size-3 shrink-0 text-primary/80" aria-hidden />
                <span className="min-w-0 truncate">Delivery: {deliveryEstimate}</span>
              </>
            )
          )}
          {isLowStock && (
            <span className={`shrink-0 font-medium text-amber-600 ${showDelivery ? "ml-auto" : ""}`}>
              Only {product.stockQuantity} left
            </span>
          )}
        </div>

        {/* Action area — ONE main button per card, pinned to the bottom so all
            buttons in a row share the same baseline. Out of stock swaps the
            Add to Cart button for the existing Notify Me control. */}
        <div className="mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
          {isOutOfStock ? (
            <div data-slot="out-of-stock-action">
              {/* The compact Notify Me control alone — the Out of Stock state
                  lives in the status row above, so this button starts on the
                  same baseline as Add to Cart on every other card. */}
              <StockAlertButton productId={product._id as any} productName={product.name} compact />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                aria-label={`Add ${product.name} to cart`}
                className="h-8 min-h-8 flex-1 gap-1 rounded-[4px] border border-emerald-900/20 px-2 py-0 text-[11px] font-semibold gradient-primary text-white shadow-sm transition-all duration-300 hover:shadow-glow active:scale-[0.98] sm:text-xs"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="size-3.5 shrink-0 max-sm:hidden" aria-hidden />
                <span className="truncate">Add to Cart</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Buy ${product.name} now`}
                className="hidden h-8 shrink-0 rounded-[4px] border border-border/60 px-2 py-0 text-[11px] font-semibold hover:border-primary/30 hover:bg-primary/[0.03] sm:inline-flex"
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
