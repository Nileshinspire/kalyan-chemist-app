import { memo } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Pill, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { useState } from "react";
import { toast } from "sonner";

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
}

const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const addToCart = useMutation(api.cart.addItem);
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const isWishlisted = useQuery(
    api.wishlist.isWishlisted,
    { productId: product._id as any }
  );

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await addToCart({ productId: product._id as any, quantity: 1 });
      toast.success(`${product.name} added to cart`);
    } catch (error: any) {
      if (error.message === "Not authenticated") {
        toast.error("Please sign in to add items to cart");
        navigate("/auth");
      } else {
        toast.error(error.message || "Failed to add to cart");
      }
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleAddToCart(e).then(() => navigate("/cart"));
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleWishlist({ productId: product._id as any });
    } catch (error: any) {
      if (error.message === "Not authenticated") {
        toast.error("Please sign in to use wishlist");
      } else {
        toast.error(error.message || "Failed to update wishlist");
      }
    }
  };

  const hasDiscount = product.discountPrice && product.discountPrice < product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0;

  const displayInfo = product.dosage || product.strength || product.form || "";

  return (
    <Card
      className="group relative overflow-hidden border-border/60 bg-card cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1"
      onClick={() => navigate(`/products/${product.slug}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Wishlist button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background hover:scale-110 transition-all duration-300 opacity-0 group-hover:opacity-100"
        onClick={handleWishlist}
      >
        <Heart className={`size-4 transition-colors ${isWishlisted ? "fill-rose-500 text-rose-500" : "text-muted-foreground group-hover:text-rose-500"}`} />
      </Button>

      {/* Product image placeholder */}
      <div className="relative flex items-center justify-center bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] h-44 border-b border-border/40 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {product.imageUrl && product.imageUrl !== "/placeholder-medicine.svg" ? (
          <img src={product.imageUrl} alt={product.name} className="size-20 object-contain" />
        ) : (
          <Pill
            className={`size-14 text-primary/20 transition-all duration-500 ${
              isHovered ? "scale-125 text-primary/35 rotate-6" : ""
            }`}
          />
        )}
        {hasDiscount && (
          <div className="absolute top-3 left-3">
            <Badge className="text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
              {discountPct}% OFF
            </Badge>
          </div>
        )}
        {product.stockQuantity > 0 && product.stockQuantity < 10 && (
          <div className="absolute bottom-3 left-3">
            <Badge
              variant="outline"
              className="text-[10px] font-medium text-amber-600 border-amber-300 bg-amber-50/80 backdrop-blur-sm"
            >
              Only {product.stockQuantity} left
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="space-y-2.5">
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
            <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300">
              {product.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{product.manufacturer}</p>
          </div>

          {displayInfo && (
            <p className="text-xs text-muted-foreground">
              {displayInfo}{product.packSize ? ` · ${product.packSize}` : ""}
            </p>
          )}

          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-foreground">
              {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                {formatCurrency(product.price)}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-9 text-xs font-semibold gap-1 gradient-primary text-white shadow-sm hover:shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleBuyNow}
              disabled={product.stockQuantity === 0}
            >
              <Zap className="size-3" />
              {product.stockQuantity === 0 ? "Out of Stock" : "Buy Now"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-9 text-xs font-semibold gap-1 border border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-300"
              onClick={handleAddToCart}
              disabled={product.stockQuantity === 0}
            >
              <ShoppingCart className="size-3" />
              Cart
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default ProductCard;
