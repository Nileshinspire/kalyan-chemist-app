import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  Pill,
  ShieldCheck,
  Truck,
  Zap,
  Tag,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const cartItems = useQuery(api.cart.list);
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeItem = useMutation(api.cart.removeItem);

  const handleUpdateQuantity = async (cartItemId: string, newQuantity: number) => {
    try {
      await updateQuantity({ cartItemId: cartItemId as any, quantity: newQuantity });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update quantity");
    }
  };

  const handleRemove = async (cartItemId: string, productName: string) => {
    try {
      await removeItem({ cartItemId: cartItemId as any });
      toast.success("Removed from cart", { description: productName });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove item");
    }
  };

  const subtotal =
    cartItems?.reduce((sum, item) => {
      if (!item.product) return sum;
      const price = item.product.discountPrice && item.product.discountPrice < item.product.price
        ? item.product.discountPrice : item.product.price;
      return sum + price * item.quantity;
    }, 0) ?? 0;

  const savings =
    cartItems?.reduce((sum, item) => {
      if (!item.product) return sum;
      if (item.product.discountPrice && item.product.discountPrice < item.product.price) {
        return sum + (item.product.price - item.product.discountPrice) * item.quantity;
      }
      return sum;
    }, 0) ?? 0;

  const itemCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

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
              <ShoppingCart className="size-10 text-primary/25" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Your Cart is Empty</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Sign in to start shopping and manage your cart.
            </p>
            <Button className="mt-6 font-semibold gradient-primary text-white rounded-xl" onClick={() => navigate("/auth?returnTo=/cart")}>
              Sign In
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

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-primary transition-colors rounded-xl"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="size-4" />
              Continue Shopping
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Shopping Cart
            </h1>
          </motion.div>

          {cartItems === undefined ? (
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl border border-border/60">
                    <Skeleton className="h-20 w-20 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : cartItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="size-20 rounded-2xl bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] flex items-center justify-center mb-4">
                <ShoppingCart className="size-9 text-primary/25" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Your cart is empty</h3>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm leading-relaxed">
                Browse our catalogue of genuine medicines and add items to your cart.
              </p>
              <Button className="mt-5 font-semibold gradient-primary text-white rounded-xl" onClick={() => navigate("/products")}>
                Browse Medicines
              </Button>
            </motion.div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Cart items */}
              <div className="lg:col-span-2 space-y-3">
                <p className="text-sm text-muted-foreground mb-2">
                  <span className="font-semibold text-foreground">{itemCount}</span> item{itemCount !== 1 ? "s" : ""} in your cart
                </p>

                <AnimatePresence>
                  {cartItems.map((item, index) => {
                    if (!item.product) return null;
                    const p = item.product;
                    const effectivePrice = p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;
                    const lineTotal = effectivePrice * item.quantity;

                    return (
                      <motion.div
                        key={item._id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16, height: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="flex gap-4 p-4 rounded-2xl border border-border/60 bg-card transition-all duration-200 hover:shadow-card-hover hover:border-primary/15"
                      >
                        {/* Image */}
                        <div
                          className="flex items-center justify-center h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br from-primary/[0.05] to-primary/[0.01] border border-border/40 cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => navigate(`/products/${p.slug}`)}
                        >
                          <Pill className="size-8 text-primary/20" />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3
                                className="text-sm font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                                onClick={() => navigate(`/products/${p.slug}`)}
                              >
                                {p.name}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {p.manufacturer} · {p.dosage} · {p.packSize}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-xl"
                              onClick={() => handleRemove(item._id, p.name)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>

                          <div className="flex items-end justify-between mt-3">
                            {/* Quantity controls */}
                            <div className="flex items-center rounded-xl border border-border/60 bg-muted/30">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-l-xl"
                                onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="size-3" />
                              </Button>
                              <span className="min-w-[2rem] text-center text-sm font-bold">
                                {item.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-r-xl"
                                onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                                disabled={item.quantity >= p.stockQuantity}
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>

                            {/* Line total */}
                            <div className="text-right">
                              <span className="text-sm font-bold text-foreground">
                                {formatCurrency(lineTotal)}
                              </span>
                              {(p.discountPrice ?? 0) < p.price && (
                                <p className="text-xs text-muted-foreground line-through">
                                  {formatCurrency(p.price * item.quantity)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Order summary */}
              <div className="lg:col-span-1">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="sticky top-24 rounded-2xl border border-border/60 bg-card p-6 space-y-5 shadow-sm"
                >
                  <h2 className="text-lg font-bold text-foreground">Order Summary</h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                      <span className="font-medium text-foreground">{formatCurrency(subtotal + savings)}</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex items-center justify-between text-green-600 bg-green-50 rounded-xl px-3 py-2">
                        <span className="flex items-center gap-1"><Tag className="size-3" /> Discount</span>
                        <span className="font-semibold">-{formatCurrency(savings)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="flex justify-between items-baseline">
                    <span className="text-base font-bold text-foreground">Total</span>
                    <span className="text-xl font-extrabold text-gradient">{formatCurrency(subtotal)}</span>
                  </div>

                  <Button
                    size="lg"
                    className="w-full font-semibold gradient-primary text-white rounded-xl shadow-glow hover:shadow-card-hover transition-all hover:scale-[1.01] active:scale-[0.99]"
                    onClick={() => navigate("/checkout")}
                  >
                    <Zap className="size-4 mr-1.5" />
                    Proceed to Checkout
                  </Button>

                  {/* Trust signals */}
                  <div className="space-y-2.5 pt-2">
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ShieldCheck className="size-3.5 text-primary" />
                      </div>
                      100% genuine medicines guaranteed
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Truck className="size-3.5 text-primary" />
                      </div>
                      Free delivery on all orders
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
