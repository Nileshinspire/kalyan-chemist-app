import { memo, useCallback } from "react";
import { useNavigate, useLocation, type NavigateFunction } from "react-router";
import { beginProductTransition } from "@/lib/product-transition";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Pill } from "lucide-react";
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
 * This card is the Hot Sellers card. Its box and inner rhythm from `sm` up are
 * lifted verbatim from the homepage Hot Sellers section — the reference the
 * whole catalogue is measured against:
 *
 *   box          rounded-2xl · border-border/70 · bg-card · 16px padding
 *   image band   128px tall, rounded-xl, clean white packshot field,
 *                `object-contain` so the product keeps its aspect ratio
 *   details      name (14/20) → manufacturer (12/16) → price (16px extrabold)
 *   action       ONE full-width `Add to Cart`, 32px tall
 *
 * Total height is therefore a constant 288px at every desktop width (the same
 * number the Hot Sellers section renders), and it is pinned with
 * `min-h-[var(--kc-card-h)]` so a product with no manufacturer cannot shrink
 * its card. Nothing here derives height from the product: the band is a fixed
 * strip, the name and the manufacturer are single clamped lines, and the action
 * row is anchored to the bottom of the card, so two cards side by side are
 * always identical.
 *
 * Phones keep the card they already had (square band, chip row, dosage line,
 * Buy Now + Cart) — every desktop-only value below is added as an `sm:`
 * utility, so nothing below 640px changes.
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

      {/* Image band — the reference strip: square on phones, 128px from `sm` up.
          Absolutely nothing inside it contributes to the card's box. */}
      {/* A clean white packshot field, frame-consistent across every section and
          the same height as before (square on phones, 128px from `sm` up). The
          picture is only ever contained, centred, and never cropped or
          stretched, and the hairline inset ring gives the product the crisp
          framing of a studio packshot without changing the card's box. */}
      <div className="relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white max-sm:mb-0 max-sm:border-b max-sm:border-border/40 sm:mb-3 sm:aspect-auto sm:h-32 sm:ring-1 sm:ring-border/50 sm:ring-inset">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {realImage ? (
          <ProductImage src={realImage} alt={product.name} />
        ) : (
          <Pill
            className="size-10 text-primary/20 transition-all duration-500 group-hover:scale-125 group-hover:text-primary/35 group-hover:rotate-6"
          />
        )}
        {newArrival && (
          <div className="absolute top-2 left-2">
            <Badge className="text-[10px] font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-0 shadow-md">
              New
            </Badge>
          </div>
        )}
        {/* The badge renders only for a discount that actually rounds to at
            least 1%, so a card can never advertise "0% OFF" for a product the
            discount section would not match. */}
        {discountPct > 0 && (
          <div className={`absolute left-2 ${newArrival ? "top-10" : "top-2"}`}>
            <Badge className="text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
              {discountPct}% OFF
            </Badge>
          </div>
        )}
        {/* Rx rides on the band from `sm` up (the reference treatment). The
            reference puts it top-right; the wishlist heart owns that corner
            here, so it sits bottom-left. Phones keep their chip row instead. */}
        {product.prescriptionRequired && (
          <div className="absolute bottom-2 left-2 max-sm:hidden">
            <Badge variant="secondary" className="text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
              Rx
            </Badge>
          </div>
        )}
        {product.stockQuantity > 0 && product.stockQuantity < 10 && (
          <div className="absolute bottom-2 right-2">
            <Badge
              variant="outline"
              className="text-[10px] font-medium text-amber-600 border-amber-300 bg-amber-50/80 backdrop-blur-sm"
            >
              Only {product.stockQuantity} left
            </Badge>
          </div>
        )}
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

          <div>
            <h3 className="line-clamp-2 text-[13px] leading-tight font-semibold text-foreground transition-colors duration-300 group-hover:text-primary sm:line-clamp-none sm:truncate sm:text-sm sm:leading-5">
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

          <div className="mt-1.5 flex items-baseline gap-1.5 sm:mt-2">
            <span className="text-base font-extrabold text-foreground">
              {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
            </span>
            {hasDiscount && (
              <span className="text-[11px] text-muted-foreground line-through sm:text-xs">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>
        </div>

        {/* Action row — anchored to the bottom of the card, so a shorter
            details block absorbs the slack above the button, not under it. */}
        <div className="mt-auto flex flex-wrap max-sm:gap-1.5 max-sm:pt-2">
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
          {/* From `sm` up: the reference's single full-width Add to Cart. */}
          <Button
            size="sm"
            className="hidden w-full rounded-lg text-xs font-semibold gradient-primary text-white sm:mt-3 sm:flex h-8"
            onClick={handleAddToCart}
            disabled={product.stockQuantity === 0}
          >
            <ShoppingCart className="size-3 mr-1" />
            {product.stockQuantity === 0 ? "Out of Stock" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

export default ProductCard;
