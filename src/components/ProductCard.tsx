import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Pill, Plus, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import type { Doc } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";

interface ProductCardProps {
  product: Doc<"products">;
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const addToCart = useMutation(api.cart.addItem);
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const cartItems = useQuery(api.cart.list);
  const [isAdding, setIsAdding] = useState(false);

  const cartItem = cartItems?.find(
    (item) => item.productId === product._id
  );
  const cartQuantity = cartItem?.quantity ?? 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAdding(true);
    try {
      await addToCart({ productId: product._id, quantity: 1 });
      toast.success("Added to cart", { description: product.name });
    } catch (error) {
      toast.error("Could not add to cart", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
    setIsAdding(false);
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleWishlist({ productId: product._id });
    } catch {
      toast.error("Please sign in to save items");
    }
  };

  const hasDiscount =
    product.discountPrice && product.discountPrice < product.price;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.price - product.discountPrice!) / product.price) * 100
      )
    : 0;

  return (
    <Card
      className="group relative overflow-hidden border-border/60 bg-card cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
      onClick={() => navigate(`/products/${product.slug}`)}
    >
      {/* Wishlist button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
        onClick={handleWishlist}
      >
        <Heart className="size-4 text-muted-foreground transition-colors group-hover:text-rose-500" />
      </Button>

      {/* Product image placeholder */}
      <div className="flex items-center justify-center bg-primary/[0.03] h-40 border-b border-border/40">
        <Pill className="size-12 text-primary/20" />
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {product.requiresPrescription && (
              <Badge variant="secondary" className="text-[10px] font-medium">
                Rx Required
              </Badge>
            )}
            {hasDiscount && (
              <Badge className="text-[10px] font-medium bg-green-600 hover:bg-green-600">
                {discountPct}% OFF
              </Badge>
            )}
            {product.stockQuantity < 10 && product.stockQuantity > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium text-amber-600">
                Low Stock
              </Badge>
            )}
          </div>

          {/* Name & manufacturer */}
          <div>
            <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {product.manufacturer}
            </p>
          </div>

          {/* Dosage & pack */}
          <p className="text-xs text-muted-foreground">
            {product.dosage} · {product.packSize}
          </p>

          {/* Price & CTA */}
          <div className="flex items-end justify-between pt-1">
            <div>
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
              </span>
              {hasDiscount && (
                <span className="ml-1.5 text-xs text-muted-foreground line-through">
                  {formatCurrency(product.price)}
                </span>
              )}
            </div>

            {cartQuantity > 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Cart quantity decrease handled by cart page
                  }}
                >
                  <Minus className="size-3" />
                </Button>
                <span className="text-sm font-semibold min-w-[1.5rem] text-center">
                  {cartQuantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleAddToCart}
                  disabled={isAdding}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs font-semibold gap-1"
                onClick={handleAddToCart}
                disabled={isAdding || product.stockQuantity === 0}
              >
                <ShoppingCart className="size-3" />
                {product.stockQuantity === 0 ? "Out of Stock" : "Add"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
