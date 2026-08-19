import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart, Trash2, Pill, ArrowLeft, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function Wishlist() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const wishlistItems = useQuery(api.wishlist.list);
  const removeFromWishlist = useMutation(api.wishlist.remove);
  const addToCart = useMutation(api.cart.addItem);

  const handleRemove = async (productId: string, productName: string) => {
    try {
      await removeFromWishlist({ productId: productId as any });
      toast.success("Removed from wishlist", { description: productName });
    } catch {
      toast.error("Could not remove item");
    }
  };

  const handleAddToCart = async (productId: string, productName: string) => {
    try {
      await addToCart({ productId: productId as any, quantity: 1 });
      toast.success("Added to cart", { description: productName });
    } catch (error) {
      toast.error("Could not add to cart", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Heart className="size-16 text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Your Wishlist</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to see and manage your saved medicines.
          </p>
          <Button
            className="mt-6 font-semibold"
            onClick={() => navigate("/auth?returnTo=/wishlist")}
          >
            Sign In
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 gap-1.5 text-muted-foreground rounded-xl"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
              <Heart className="size-3" />
              Saved Items
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              My Wishlist
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              {wishlistItems === undefined
                ? "Loading…"
                : `${wishlistItems.length} saved item${wishlistItems.length !== 1 ? "s" : ""}`}
            </p>
          </motion.div>

          {wishlistItems === undefined ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl border border-border/60 animate-pulse bg-muted/30"
                />
              ))}
            </div>
          ) : wishlistItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Heart className="size-7 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                No saved items yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Browse medicines and tap the heart icon to save them here for
                later.
              </p>
              <Button
                className="mt-5 font-semibold gradient-primary text-white rounded-xl"
                onClick={() => navigate("/products")}
              >
                Browse Medicines
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {wishlistItems.map((item, index) => {
                  if (!item.product) return null;
                  const p = item.product;
                  const effectivePrice =
                    p.discountPrice && p.discountPrice < p.price
                      ? p.discountPrice
                      : p.price;

                  return (
                    <motion.div
                      key={item._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ delay: index * 0.05, duration: 0.4 }}
                      className="flex gap-4 p-4 rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/15"
                    >
                      {/* Image */}
                      <div
                        className="flex items-center justify-center h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br from-primary/[0.05] to-primary/[0.01] border border-border/40 cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => navigate(`/products/${p.slug}`)}
                      >
                        <Pill className="size-8 text-primary/20" />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h3
                            className="text-sm font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => navigate(`/products/${p.slug}`)}
                          >
                            {p.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {p.manufacturer} · {p.dosage} · {p.packSize}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-bold text-foreground">
                            {formatCurrency(effectivePrice)}
                            {p.discountPrice && p.discountPrice < p.price && (
                              <span className="ml-1.5 text-xs text-muted-foreground line-through">
                                {formatCurrency(p.price)}
                              </span>
                            )}
                          </span>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-xl"
                              onClick={() => handleRemove(p._id, p.name)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 text-xs font-semibold gap-1 gradient-primary text-white rounded-xl"
                              onClick={() => handleAddToCart(p._id, p.name)}
                              disabled={p.stockQuantity === 0}
                            >
                              <ShoppingCart className="size-3" />
                              {p.stockQuantity === 0 ? "Out of Stock" : "Add to Cart"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
