import { memo, useCallback } from "react";
import { useNavigate, useLocation, type NavigateFunction } from "react-router";
import { beginProductTransition } from "@/lib/product-transition";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Pill, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
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

/* ─── Product image presentation ───
 * Packshots arrive in every shape — square, wide and extremely tall (some are
 * 174x600) — and often carry their own baked-in white padding. The image sits
 * in a padded box inside the image band and is `object-contain`, so the whole
 * package stays visible at its natural aspect ratio with even white space on
 * every side: never cropped, never stretched, never wider than the card's image
 * area. The box is absolutely positioned, so it never contributes to the card's
 * intrinsic width (the mobile carousels size their items from content) and
 * never widens a card. The band itself is square on phones and a controlled
 * strip from `sm` up, which keeps the desktop card compact.
 */

function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="absolute inset-2.5">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
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

  const discountPct = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0;

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
      className="group relative h-full flex-col overflow-hidden border-border/60 bg-card cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1 max-sm:gap-0 max-sm:py-0"
    >
      <Card
        className="group relative h-full flex-col overflow-hidden border-border/60 bg-card cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1 max-sm:gap-0 max-sm:py-0"
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
        <div
          className="relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-xl border-b border-border/40 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] sm:aspect-auto sm:h-30 sm:min-h-0"
        >
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
          {hasDiscount && (
            <div className={`absolute left-2 ${newArrival ? "top-10" : "top-2"}`}>
              <Badge className="text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
                {discountPct}% OFF
              </Badge>
            </div>
          )}
          {product.stockQuantity > 0 && product.stockQuantity < 10 && (
            <div className="absolute bottom-2 left-2">
              <Badge
                variant="outline"
                className="text-[10px] font-medium text-amber-600 border-amber-300 bg-amber-50/80 backdrop-blur-sm"
              >
                Only {product.stockQuantity} left
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col p-2.5 sm:p-2.5">
          <div className="space-y-1.5 max-sm:space-y-1">
            <div className="flex flex-wrap gap-1.5">
              {product.prescriptionRequired && (
                <Badge variant="secondary" className="text-[10px] font-medium bg-red-50 text-red-700 border-red-200">
                  Rx Required
                </Badge>
              )}
              {!product.prescriptionRequired && (
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
              <h3 className="text-[14px] max-sm:text-[13px] max-sm:leading-snug font-semibold max-sm:leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300">
                {product.name}
              </h3>
              <p className="mt-0.5 text-[11px] max-sm:text-[10px] max-sm:leading-snug text-muted-foreground break-words max-sm:line-clamp-2">{product.manufacturer}</p>
            </div>

            {displayInfo && (
              <p className="text-[11px] max-sm:text-[10px] max-sm:leading-snug text-muted-foreground">
                {displayInfo}{product.packSize ? ` · ${product.packSize}` : ""}
              </p>
            )}

            <div className="flex items-baseline gap-1.5">
              <span className="text-base max-sm:text-base font-extrabold text-foreground">
                {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
              </span>
              {hasDiscount && (
                <span className="text-[11px] text-muted-foreground line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>
          </div>

          {/* `pt-2.5` (not `pt-2`) keeps the token the New Arrivals scoped
              rule `[class~="pt-2.5"]` matches, so that section's action-row
              spacing — mobile and desktop — stays exactly as it was. */}
          <div className="mt-auto flex flex-wrap gap-1.5 pt-2.5 max-sm:gap-1.5 max-sm:pt-2">
            <Button
              size="sm"
              className="h-7 max-sm:h-8 max-sm:min-h-8 max-sm:px-0 max-sm:py-0 flex-1 min-w-0 px-1.5 sm:px-2 text-[11px] max-sm:text-[10px] sm:text-xs font-semibold gap-0.5 gradient-primary text-white shadow-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleBuyNow}
              disabled={product.stockQuantity === 0}
            >
              <Zap className="size-3 max-sm:hidden" />
              {product.stockQuantity === 0 ? "Out of Stock" : "Buy Now"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 max-sm:h-8 max-sm:min-h-8 max-sm:px-0 max-sm:py-0 shrink-0 px-1.5 sm:px-2 text-[11px] max-sm:text-[10px] sm:text-xs font-semibold gap-0.5 border border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-300"
              onClick={handleAddToCart}
              disabled={product.stockQuantity === 0}
            >
              <ShoppingCart className="size-3 max-sm:hidden" />
              Cart
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

export default ProductCard;
