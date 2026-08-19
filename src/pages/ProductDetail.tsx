import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Heart,
  ShoppingCart,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
  AlertTriangle,
  Pill,
  BadgeCheck,
  Zap,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { useState } from "react";
import { toast } from "sonner";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const product = useQuery(api.products.getBySlug, { slug: slug ?? "" });
  const relatedProducts = useQuery(
    api.products.getRelated,
    product?.category
      ? { productId: product._id, categoryId: product.category._id }
      : "skip"
  );
  const addToCart = useMutation(api.cart.addItem);
  const toggleWishlist = useMutation(api.wishlist.toggle);
  const cartItems = useQuery(api.cart.list);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  if (product === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="size-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Pill className="size-10 text-muted-foreground/40" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Product Not Found
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              The medicine you are looking for does not exist or has been removed from our catalogue.
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

  const cartItem = cartItems?.find((item) => item.productId === product._id);
  const cartQuantity = cartItem?.quantity ?? 0;

  const hasDiscount =
    product.discountPrice && product.discountPrice < product.price;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.price - product.discountPrice!) / product.price) * 100
      )
    : 0;

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await addToCart({ productId: product._id, quantity });
      toast.success("Added to cart", {
        description: `${quantity} × ${product.name}`,
      });
    } catch (error) {
      toast.error("Could not add to cart", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
    setIsAdding(false);
  };

  const handleBuyNow = async () => {
    setIsAdding(true);
    try {
      await addToCart({ productId: product._id, quantity });
      navigate("/checkout");
    } catch (error) {
      toast.error("Could not proceed", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    }
    setIsAdding(false);
  };

  const handleWishlist = async () => {
    try {
      await toggleWishlist({ productId: product._id });
      toast.success("Added to wishlist");
    } catch {
      toast.error("Please sign in to save items");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {/* Breadcrumb */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors rounded-xl"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {/* Product detail grid */}
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/[0.06] to-primary/[0.01] border border-border/40 h-72 sm:h-96 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.03] to-transparent" />
              <Pill className="size-24 text-primary/15 relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
              {hasDiscount && (
                <div className="absolute top-4 left-4 z-10">
                  <Badge className="text-sm font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md px-3 py-1">
                    {discountPct}% OFF
                  </Badge>
                </div>
              )}
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-5"
            >
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {product.requiresPrescription && (
                  <Badge variant="secondary" className="text-xs font-medium gap-1">
                    <AlertTriangle className="size-3" />
                    Prescription Required
                  </Badge>
                )}
              </div>

              {/* Name */}
              <div>
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl leading-tight">
                  {product.name}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  by <span className="font-medium text-foreground/70">{product.manufacturer}</span>
                </p>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-foreground">
                  {formatCurrency(hasDiscount ? product.discountPrice! : product.price)}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">
                      {formatCurrency(product.price)}
                    </span>
                    <Badge className="text-xs font-bold bg-green-100 text-green-700 border-green-200">
                      Save {formatCurrency(product.price - product.discountPrice!)}
                    </Badge>
                  </>
                )}
              </div>

              <Separator className="bg-border/50" />

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Dosage</p>
                  <p className="font-semibold text-foreground mt-0.5">{product.dosage}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Pack Size</p>
                  <p className="font-semibold text-foreground mt-0.5">{product.packSize}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-semibold text-foreground mt-0.5">
                    {product.category?.name ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Availability</p>
                  <p className={`font-semibold mt-0.5 ${product.stockQuantity > 0 ? "text-green-600" : "text-destructive"}`}>
                    {product.stockQuantity > 0
                      ? `In Stock (${product.stockQuantity} units)`
                      : "Out of Stock"}
                  </p>
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Quantity & Actions */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    Quantity
                  </span>
                  <div className="flex items-center rounded-xl border border-border/60 bg-muted/30">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-l-xl"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="min-w-[2.5rem] text-center text-sm font-bold">
                      {quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-r-xl"
                      onClick={() =>
                        setQuantity(Math.min(product.stockQuantity, quantity + 1))
                      }
                      disabled={quantity >= product.stockQuantity}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  {cartQuantity > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                      {cartQuantity} already in cart
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    size="lg"
                    className="flex-1 font-semibold gap-2 gradient-primary text-white shadow-glow hover:shadow-card-hover transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl"
                    onClick={handleBuyNow}
                    disabled={isAdding || product.stockQuantity === 0}
                  >
                    {product.stockQuantity === 0 ? "Out of Stock" : (
                      <>
                        <Zap className="size-4" />
                        Buy Now
                      </>
                    )}
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="flex-1 font-semibold gap-2 border border-border/60 hover:border-primary/30 transition-all rounded-xl"
                    onClick={handleAddToCart}
                    disabled={isAdding || product.stockQuantity === 0}
                  >
                    <ShoppingCart className="size-4" />
                    Add to Cart
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="px-3 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all rounded-xl"
                    onClick={handleWishlist}
                  >
                    <Heart className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Trust signals */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="flex flex-col items-center gap-1.5 rounded-xl bg-gradient-to-b from-primary/[0.04] to-transparent p-3 text-center">
                  <ShieldCheck className="size-5 text-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight">100% Genuine</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 rounded-xl bg-gradient-to-b from-primary/[0.04] to-transparent p-3 text-center">
                  <Truck className="size-5 text-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight">Fast Delivery</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 rounded-xl bg-gradient-to-b from-primary/[0.04] to-transparent p-3 text-center">
                  <BadgeCheck className="size-5 text-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight">Verified Seller</span>
                </div>
              </div>

              {/* Prescription warning */}
              {product.requiresPrescription && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-amber-50/50 p-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <AlertTriangle className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Prescription Required
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
                      This is a prescription medicine. Please ensure you have a
                      valid prescription from a registered medical practitioner
                      before ordering. Our pharmacist may verify your
                      prescription before dispatch.
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="rounded-xl bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Pill className="size-3.5 text-primary" />
                  About this product
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Related products */}
          {relatedProducts && relatedProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mt-16"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3" />
                You may also like
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground mb-6">
                Related Products
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {relatedProducts.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
