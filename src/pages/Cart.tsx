import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Truck,
  Pill,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";
import { generateCartMessage, openWhatsApp } from "@/lib/whatsapp";

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const cartItems = useQuery(api.cart.list);
  const updateQuantity = useMutation(api.cart.updateQuantity);
  const removeItem = useMutation(api.cart.removeItem);
  const clearCart = useMutation(api.cart.clear);
  const deliveryConfig = useQuery(api.deliveryConfig.getPublic);

  const handleUpdateQuantity = async (cartItemId: string, newQty: number) => {
    try {
      await updateQuantity({ cartItemId: cartItemId as any, quantity: newQty });
    } catch (error: any) {
      toast.error(error.message || "Failed to update quantity");
    }
  };

  const handleRemoveItem = async (cartItemId: string) => {
    try {
      await removeItem({ cartItemId: cartItemId as any });
      toast.success("Item removed from cart");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove item");
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
      toast.success("Cart cleared");
    } catch (error: any) {
      toast.error(error.message || "Failed to clear cart");
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
              <ShoppingCart className="size-10 text-primary/25" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Sign In to Shop</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Sign in to start shopping and manage your cart.
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

  // Loading state
  if (cartItems === undefined) {
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

  // Empty cart
  if (cartItems.length === 0) {
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
              Browse our catalogue and add items to your cart.
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

  // Cart with items
  const subtotal = cartItems.reduce((sum, item) => {
    const price = item.product?.discountPrice && item.product.discountPrice < item.product.price
      ? item.product.discountPrice
      : item.product?.price ?? 0;
    return sum + price * item.quantity;
  }, 0);

  const savings = cartItems.reduce((sum, item) => {
    if (item.product?.discountPrice && item.product.discountPrice < item.product.price) {
      return sum + (item.product.price - item.product.discountPrice) * item.quantity;
    }
    return sum;
  }, 0);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasPrescriptionItems = cartItems.some((item) => item.product?.prescriptionRequired);

  const handleWhatsApp = () => {
    const phone = deliveryConfig?.storeWhatsApp || deliveryConfig?.storePhone || "";
    if (!phone) {
      toast.error("WhatsApp number not configured");
      return;
    }
    const products = cartItems
      .filter((item) => item.product)
      .map((item) => ({
        name: item.product!.name,
        quantity: item.quantity,
        price: item.product!.discountPrice && item.product!.discountPrice < item.product!.price
          ? item.product!.discountPrice!
          : item.product!.price,
      }));
    openWhatsApp(phone, generateCartMessage({ products, subtotal }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Shopping Cart</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {totalItems} item(s) in your cart
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs" onClick={handleClearCart}>
              <Trash2 className="size-3.5 mr-1" />
              Clear Cart
            </Button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            {/* Cart Items */}
            <div className="space-y-3">
              {cartItems.map((item) => {
                const product = item.product;
                if (!product) return null;
                const hasDiscount = product.discountPrice && product.discountPrice < product.price;
                const unitPrice = hasDiscount ? product.discountPrice! : product.price;
                const itemTotal = unitPrice * item.quantity;

                return (
                  <motion.div
                    key={item._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                  >
                    <Card className="border-border/60">
                      <CardContent className="p-4 flex gap-4">
                        {/* Image */}
                        <div
                          className="shrink-0 w-20 h-20 rounded-xl bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] flex items-center justify-center cursor-pointer"
                          onClick={() => navigate(`/products/${product.slug}`)}
                        >
                          <Pill className="size-8 text-primary/20" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3
                                className="text-sm font-semibold truncate hover:text-primary cursor-pointer transition-colors"
                                onClick={() => navigate(`/products/${product.slug}`)}
                              >
                                {product.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">{product.manufacturer}</p>
                              {product.prescriptionRequired && (
                                <Badge variant="destructive" className="text-[10px] mt-1">Rx</Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveItem(item._id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            {/* Quantity controls */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-8 rounded-lg"
                                onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                              >
                                <Minus className="size-3" />
                              </Button>
                              <span className="text-sm font-semibold w-8 text-center">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="size-8 rounded-lg"
                                onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                                disabled={item.quantity >= product.stockQuantity}
                              >
                                <Plus className="size-3" />
                              </Button>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                              <span className="text-base font-extrabold">{formatCurrency(itemTotal)}</span>
                              {hasDiscount && (
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(unitPrice)} × {item.quantity}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Card className="border-border/60">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-bold">Order Summary</h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                      <span className="font-medium">{formatCurrency(subtotal + savings)}</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span className="font-medium">-{formatCurrency(savings)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                    <div className="border-t border-border/60 pt-3 flex justify-between">
                      <span className="font-bold">Total</span>
                      <span className="font-extrabold text-lg">{formatCurrency(subtotal)}</span>
                    </div>
                  </div>

                  {hasPrescriptionItems && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                      <p className="font-semibold">Prescription items in cart</p>
                      <p className="mt-1">Please have your prescription ready for upload during checkout.</p>
                    </div>
                  )}

                  <Button
                    className="w-full h-12 text-sm font-semibold gradient-primary text-white shadow-glow rounded-xl"
                    onClick={() => navigate("/checkout")}
                  >
                    Proceed to Checkout
                    <ArrowRight className="ml-2 size-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={() => navigate("/products")}
                  >
                    Continue Shopping
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-10 text-sm font-semibold gap-2 rounded-xl border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
                    onClick={handleWhatsApp}
                  >
                    <MessageCircle className="size-4" />
                    Order on WhatsApp
                  </Button>

                  <div className="flex flex-col gap-2 pt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-3.5 text-primary shrink-0" />
                      100% Genuine medicines
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="size-3.5 text-primary shrink-0" />
                      Free delivery on all orders
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
