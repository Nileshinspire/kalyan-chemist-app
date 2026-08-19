import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Heart,
  ShoppingCart,
  Trash2,
  ArrowRight,
  Pill,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";

export default function Wishlist() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const wishlistItems = useQuery(api.wishlist.list);
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const moveToCart = useMutation(api.wishlist.moveToCart);
  const addToCart = useMutation(api.cart.addItem);

  const handleRemove = async (productId: string) => {
    try {
      await toggleWishlist({ productId: productId as any });
      toast.success("Removed from wishlist");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove");
    }
  };

  const handleMoveToCart = async (productId: string) => {
    try {
      await moveToCart({ productId: productId as any });
      toast.success("Moved to cart");
    } catch (error: any) {
      toast.error(error.message || "Failed to move to cart");
    }
  };

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart({ productId: productId as any, quantity: 1 });
      toast.success("Added to cart");
    } catch (error: any) {
      toast.error(error.message || "Failed to add to cart");
    }
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="size-20 rounded-2xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] flex items-center justify-center mb-4">
              <Heart className="size-10 text-primary/25" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Sign In to View Wishlist</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Sign in to save medicines to your wishlist for later.
            </p>
            <Button
              className="mt-6 font-semibold gradient-primary text-white rounded-xl"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  // Loading
  if (wishlistItems === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  // Empty
  if (wishlistItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="size-20 rounded-2xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] flex items-center justify-center mb-4">
              <Heart className="size-10 text-primary/25" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Your Wishlist is Empty</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Save medicines you want to buy later by clicking the heart icon.
            </p>
            <Button
              className="mt-6 font-semibold gradient-primary text-white rounded-xl"
              onClick={() => navigate("/products")}
            >
              Browse Medicines
            </Button>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">My Wishlist</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {wishlistItems.length} item(s) saved
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wishlistItems.map((item) => {
              const product = item.product;
              if (!product) return null;

              const hasDiscount = product.discountPrice && product.discountPrice < product.price;
              const displayPrice = hasDiscount ? product.discountPrice! : product.price;
              const isInStock = product.stockQuantity > 0;
              const isLowStock = product.stockQuantity > 0 && product.stockQuantity < 10;

              return (
                <motion.div
                  key={item._id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                >
                  <Card className="border-border/60 overflow-hidden group hover:shadow-card-hover hover:border-primary/20 transition-all duration-300">
                    {/* Product image area */}
                    <div
                      className="relative flex items-center justify-center bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] h-40 cursor-pointer"
                      onClick={() => navigate(`/products/${product.slug}`)}
                    >
                      <Pill className="size-12 text-primary/20 group-hover:scale-110 transition-all duration-500" />
                      {hasDiscount && (
                        <Badge className="absolute top-3 left-3 text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
                          {Math.round(((product.price - product.discountPrice!) / product.price) * 100)}% OFF
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 size-8 rounded-full bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive hover:bg-background"
                        onClick={() => handleRemove(product._id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <CardContent className="p-4">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {product.prescriptionRequired ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <AlertTriangle className="size-2.5 mr-1" />
                            Rx Required
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-green-700 border-green-200">
                            OTC
                          </Badge>
                        )}
                      </div>

                      {/* Name */}
                      <h3
                        className="text-sm font-semibold line-clamp-2 hover:text-primary cursor-pointer transition-colors"
                        onClick={() => navigate(`/products/${product.slug}`)}
                      >
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.manufacturer}
                      </p>

                      {/* Price */}
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-lg font-extrabold">{formatCurrency(displayPrice)}</span>
                        {hasDiscount && (
                          <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                        )}
                      </div>

                      {/* Stock status */}
                      <div className="mt-2">
                        {isInStock ? (
                          <div className="flex items-center gap-1.5">
                            <div className={`size-1.5 rounded-full ${isLowStock ? "bg-amber-500" : "bg-green-500"}`} />
                            <span className={`text-xs ${isLowStock ? "text-amber-600" : "text-green-600"}`}>
                              {isLowStock ? `Only ${product.stockQuantity} left` : "In Stock"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="size-1.5 rounded-full bg-red-500" />
                            <span className="text-xs text-red-600">Out of Stock</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          className="flex-1 h-9 text-xs font-semibold gap-1 gradient-primary text-white rounded-lg"
                          onClick={() => handleMoveToCart(product._id)}
                          disabled={!isInStock}
                        >
                          <ShoppingCart className="size-3" />
                          {isInStock ? "Move to Cart" : "Out of Stock"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs rounded-lg"
                          onClick={() => navigate(`/products/${product.slug}`)}
                        >
                          <ArrowRight className="size-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
