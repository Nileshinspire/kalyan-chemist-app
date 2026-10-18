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
 * Information hierarchy follows the Apollo Pharmacy reference sheet:
 *
 *   media        clean white packshot field, `object-contain` so the product
 *                keeps its aspect ratio, with a compact `Add` control in a
 *                narrow column beside it (vertically centred on the image)
 *   rating       real average + review count, as a green pill on the media
 *   attributes   pack size / form chips, from saved fields only
 *   name         two clamped lines
 *   brand        manufacturer, one clamped line
 *   delivery     the store's own admin-configured estimate, when set
 *   price        MRP struck through + discount % once, then the effective price
 *
 * The box is pinned with `min-h-[var(--kc-card-h)]`, and the price block is
 * anchored to the bottom, so two cards side by side stay identical. Every
 * desktop-only value below is an `sm:` utility, so phones keep their existing
 * full-bleed media band and Buy Now / Cart row.
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

/**
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

  const displayInfo = product.dosage || product.strength || product.form || "";
  const isLowStock = product.stockQuantity > 0 && product.stockQuantity < 10;

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
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1 max-sm:rounded-xl max-sm:border-border/60 max-sm:shadow-sm sm:min-h-[var(--kc-card-h)] sm:p-4"
      onClick={() => goProduct(navigate, location.pathname + location.search, product.slug)}
      onMouseEnter={warmProductDetail}
      onFocus={warmProductDetail}
      onPointerDown={warmProductDetail}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background hover:scale-110 transition-all duration-300 opacity-100 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100"
        onClick={handleWishlist}
      >
        <Heart className={`size-3.5 transition-colors ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground group-hover:text-rose-500"}`} />
      </Button>

      {/* Media — clean white packshot field with the compact `Add` control on
          its bottom-right edge, beside the product (the reference placement).
          The button is overlaid, not in a side column, so the packshot keeps
          its full width even in the narrowest grid at 1024px. Phones keep the
          full-bleed square band and their own Buy Now / Cart row, so neither
          the image nor the controls can get cramped. */}
      <div className="relative shrink-0">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-white max-sm:rounded-b-none max-sm:border-b max-sm:border-border/40 sm:aspect-auto sm:h-32 sm:ring-1 sm:ring-border/50 sm:ring-inset">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {realImage ? (
            <ProductImage src={realImage} alt={product.name} />
          ) : (
            <Pill
              className="size-10 text-primary/20 transition-all duration-500 group-hover:scale-125 group-hover:text-primary/35 group-hover:rotate-6"
            />
          )}
          {newArrival && (
            <div className="absolute top-2 left-2 z-[1]">
              <Badge className="text-[10px] font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-0 shadow-md">
                New
              </Badge>
            </div>
          )}
          {/* Rx rides on the band from `sm` up. Phones keep their chip row.
              The discount badge that used to live here is gone: the percentage
              is printed once, beside the price below. */}
          {product.prescriptionRequired && (
            <div className={`absolute left-2 z-[1] max-sm:hidden ${newArrival ? "top-9" : "top-2"}`}>
              <Badge variant="secondary" className="text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                Rx
              </Badge>
            </div>
          )}
          {/* The real review summary, on the media like the reference. Nothing
              renders when the product has no saved reviews. */}
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-[1]">
            <ProductRatingBadge productId={product._id} />
          </div>
        </div>

        {/* Compact add control, beside the product image on its bottom edge. */}
        <div className="absolute right-1.5 bottom-1.5 z-[2] max-sm:hidden">
          <Button
            size="sm"
            aria-label={product.stockQuantity === 0 ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
            className={`h-7 w-[52px] rounded-lg px-1 font-semibold gradient-primary text-white shadow-sm transition-all duration-300 hover:shadow-glow hover:scale-[1.03] active:scale-[0.97] ${product.stockQuantity === 0 ? "text-[8px]" : "text-[11px]"}`}
            onClick={handleAddToCart}
            disabled={product.stockQuantity === 0}
          >
            {product.stockQuantity === 0 ? "Sold out" : "Add"}
          </Button>
        </div>
      </div>

      {/* On phones the image band is full-bleed and this block carries the
          10px card padding (exactly as before); from `sm` up the card itself is
          padded and this block adds nothing. */}
      <div data-slot="card-content" className="flex flex-1 flex-col max-sm:p-2.5">
        <div className="max-sm:space-y-1">
          {/* Phones keep the existing chip row; the reference card has none. */}
          <div className="flex flex-wrap gap-1.5 sm:hidden">
            {product.prescriptionRequired ? (
              <Badge variant="secondary" className="text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                Rx Required
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-medium text-green-700 border-green-200 bg-green-50/50">
                OTC
              </Badge>
            )}
            {product.brandName && (
              <Badge variant="outline" className="text-[10px] font-medium">
                {product.brandName}
              </Badge>
            )}
          </div>

          {/* Pack/packaging labels — compact attribute row directly below the
              media, from saved fields only (packSize is required, form only
              when it exists). One non-wrapping line, so cards stay aligned. */}
          <div className="mt-2 mb-1 hidden min-w-0 flex-nowrap items-center gap-1 overflow-hidden sm:mt-2.5 sm:flex">
            {product.packSize && (
              <span className="shrink-0 whitespace-nowrap rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] leading-3 font-medium text-muted-foreground">
                {product.packSize}
              </span>
            )}
            {product.form && (
              <span className="min-w-0 truncate rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] leading-3 font-medium text-muted-foreground">
                {product.form}
              </span>
            )}
          </div>

          <div>
            <h3 className="line-clamp-2 text-[13px] leading-tight font-semibold text-foreground transition-colors duration-300 group-hover:text-primary sm:text-sm sm:leading-5">
              {product.name}
            </h3>
            <p className="mt-0.5 line-clamp-2 break-words text-[10px] leading-snug text-muted-foreground sm:line-clamp-none sm:truncate sm:text-xs sm:leading-4">
              {product.manufacturer}
            </p>
          </div>

          {/* Phones keep the dosage · pack line; the reference card has none. */}
          {displayInfo && (
            <p className="text-[10px] leading-snug text-muted-foreground sm:hidden">
              {displayInfo}{product.packSize ? ` · ${product.packSize}` : ""}
            </p>
          )}

          {/* One availability line: the store's own admin-configured delivery
              estimate (only when that setting exists — never invented) and the
              saved low-stock count. Both live here, on one fixed-height line,
              so neither can sit under the media's rating pill or Add control,
              and a card never changes height because of them. */}
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

          {/* Price hierarchy, reference order: struck-through MRP with the one
              and only discount percentage, then the effective selling price.
              Anchored to the bottom of the card so the block stays aligned. */}
          <div className="mt-auto pt-1.5">
            {hasDiscount && (
              <div className="flex flex-wrap items-baseline gap-x-1.5 text-[10px] leading-3 text-muted-foreground sm:text-[11px]">
                <span>MRP</span>
                <span className="line-through">{formatCurrency(product.price)}</span>
                {discountPct > 0 && (
                  <span className="font-semibold text-emerald-600">{discountPct}% off</span>
                )}
              </div>
            )}
            <div className="mt-0.5 text-base leading-6 font-extrabold text-foreground">
              {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
            </div>
          </div>
        </div>

        {/* Phone action row. The desktop control sits beside the image. */}
        <div className="flex flex-wrap max-sm:gap-1.5 max-sm:pt-2">
          {/* Phones: the unchanged two-button row. */}
          <Button
            size="sm"
            className="h-7 max-sm:h-8 max-sm:min-h-8 max-sm:px-0 max-sm:py-0 flex-1 min-w-0 px-1.5 sm:px-2 text-[11px] max-sm:text-[10px] sm:text-xs font-semibold gap-0.5 gradient-primary text-white shadow-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] sm:hidden"
            onClick={handleBuyNow}
            disabled={product.stockQuantity === 0}
          >
            {product.stockQuantity === 0 ? "Out of Stock" : "Buy Now"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 max-sm:h-8 max-sm:min-h-8 max-sm:px-0 max-sm:py-0 shrink-0 px-1.5 sm:px-2 text-[11px] max-sm:text-[10px] sm:text-xs font-semibold gap-0.5 border border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-300 sm:hidden"
            onClick={handleAddToCart}
            disabled={product.stockQuantity === 0}
          >
            Cart
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;
