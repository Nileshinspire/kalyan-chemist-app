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
import {
  ArrowLeft,
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  Pill,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const cartItems = useQuery(api.cart.list);
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeItem = useMutation(api.cart.removeItem);

  const handleUpdateQuantity = async (
    cartItemId: string,
    newQuantity: number
  ) => {
    try {
      await updateQuantity({ cartItemId: cartItemId as any, quantity: newQuantity });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update quantity"
      );
    }
  };

  const handleRemove = async (cartItemId: string, productName: string) => {
    try {
      await removeItem({ cartItemId: cartItemId as any });
      toast.success("Removed from cart", { description: productName });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove item"
      );
    }
  };

  // Calculate totals
  const subtotal =
    cartItems?.reduce((sum, item) => {
      if (!item.product) return sum;
      const price =
        item.product.discountPrice && item.product.discountPrice < item.product.price
          ? item.product.discountPrice
          : item.product.price;
      return sum + price * item.quantity;
    }, 0) ?? 0;

  const savings =
    cartItems?.reduce((sum, item) => {
      if (!item.product) return sum;
      if (
        item.product.discountPrice &&
        item.product.discountPrice < item.product.price
      ) {
        return sum + (item.product.price - item.product.discountPrice) * item.quantity;
      }
      return sum;
    }, 0) ?? 0;

  const itemCount =
    cartItems?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <ShoppingCart className="size-16 text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold text-foreground">
            Your Cart is Empty
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to start shopping and manage your cart.
          </p>
          <Button
            className="mt-6 font-semibold"
            onClick={() => navigate("/auth?returnTo=/cart")}
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="size-4" />
                Continue Shopping
              </Button>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Shopping Cart
            </h1>
          </div>

          {cartItems === undefined ? (
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl border border-border/60">
                    <Skeleton className="h-20 w-20 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ShoppingCart className="size-7 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Your cart is empty
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Browse our catalogue of genuine medicines and add items to your
                cart.
              </p>
              <Button
                className="mt-4 font-semibold"
                onClick={() => navigate("/products")}
              >
                Browse Medicines
              </Button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Cart items */}
              <div className="lg:col-span-2 space-y-3">
                <p className="text-sm text-muted-foreground mb-2">
                  {itemCount} item{itemCount !== 1 ? "s" : ""} in your cart
                </p>

                {cartItems.map((item) => {
                  if (!item.product) return null;
                  const p = item.product;
                  const effectivePrice =
                    p.discountPrice && p.discountPrice < p.price
                      ? p.discountPrice
                      : p.price;
                  const lineTotal = effectivePrice * item.quantity;

                  return (
                    <div
                      key={item._id}
                      className="flex gap-4 p-4 rounded-xl border border-border/60 bg-card transition-colors hover:border-border"
                    >
                      {/* Image */}
                      <div
                        className="flex items-center justify-center h-20 w-20 shrink-0 rounded-lg bg-primary/[0.03] border border-border/40 cursor-pointer"
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
                            <p className="text-xs text-muted-foreground">
                              {p.manufacturer} · {p.dosage} · {p.packSize}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(item._id, p.name)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        <div className="flex items-end justify-between mt-3">
                          {/* Quantity controls */}
                          <div className="flex items-center rounded-lg border border-border/60">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                handleUpdateQuantity(
                                  item._id,
                                  item.quantity - 1
                                )
                              }
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="min-w-[2rem] text-center text-sm font-semibold">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                handleUpdateQuantity(
                                  item._id,
                                  item.quantity + 1
                                )
                              }
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
                    </div>
                  );
                })}
              </div>

              {/* Order summary */}
              <div className="lg:col-span-1">
                <div className="sticky top-24 rounded-xl border border-border/60 bg-card p-6 space-y-5">
                  <h2 className="text-lg font-bold text-foreground">
                    Order Summary
                  </h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Subtotal ({itemCount} items)
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(subtotal + savings)}
                      </span>
                    </div>
                    {savings > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span className="font-medium">
                          -{formatCurrency(savings)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Delivery
                      </span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>

                  <Button
                    size="lg"
                    className="w-full font-semibold"
                    onClick={() => navigate("/checkout")}
                  >
                    Proceed to Checkout
                  </Button>

                  {/* Trust signals */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="size-3.5 text-primary" />
                      100% genuine medicines guaranteed
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Truck className="size-3.5 text-primary" />
                      Free delivery on all orders
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
