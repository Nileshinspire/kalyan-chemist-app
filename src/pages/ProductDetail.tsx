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
            <Skeleton className="h-80 w-full rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
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
          <Pill className="size-16 text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold text-foreground">
            Product Not Found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The medicine you are looking for does not exist or has been removed.
          </p>
          <Button
            className="mt-6"
            onClick={() => navigate("/products")}
          >
            Browse Medicines
          </Button>
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
      await addToCart({
        productId: product._id,
        quantity,
      });
      toast.success("Added to cart", {
        description: `${quantity} × ${product.name}`,
      });
    } catch (error) {
      toast.error("Could not add to cart", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    }
    setIsAdding(false);
  };

  const handleBuyNow = async () => {
    setIsAdding(true);
    try {
      await addToCart({
        productId: product._id,
        quantity,
      });
      navigate("/checkout");
    } catch (error) {
      toast.error("Could not proceed", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    }
    setIsAdding(false);
  };

  const handleWishlist = async () => {
    try {
      await toggleWishlist({ productId: product._id });
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
            className="mb-6 gap-1.5 text-sm text-muted-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {/* Product detail grid */}
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Image */}
            <div className="flex items-center justify-center rounded-xl bg-primary/[0.03] border border-border/40 h-72 sm:h-96">
              <Pill className="size-20 text-primary/15" />
            </div>

            {/* Info */}
            <div className="space-y-5">
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {product.requiresPrescription && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium gap-1"
                  >
                    <AlertTriangle className="size-3" />
                    Prescription Required
                  </Badge>
                )}
                {hasDiscount && (
                  <Badge className="text-xs font-medium bg-green-600 hover:bg-green-600">
                    {discountPct}% OFF
                  </Badge>
                )}
              </div>

              {/* Name */}
              <div>
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                  {product.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  by {product.manufacturer}
                </p>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-foreground">
                  {formatCurrency(
                    hasDiscount ? product.discountPrice! : product.price
                  )}
                </span>
                {hasDiscount && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatCurrency(product.price)}
                  </span>
                )}
              </div>

              <Separator />

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Dosage</p>
                  <p className="font-medium text-foreground">{product.dosage}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pack Size</p>
                  <p className="font-medium text-foreground">
                    {product.packSize}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground">
                    {product.category?.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Availability</p>
                  <p
                    className={`font-medium ${
                      product.stockQuantity > 0
                        ? "text-green-600"
                        : "text-destructive"
                    }`}
                  >
                    {product.stockQuantity > 0
                      ? `In Stock (${product.stockQuantity} units)`
                      : "Out of Stock"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Quantity & Add to Cart */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    Quantity
                  </span>
                  <div className="flex items-center rounded-lg border border-border/60">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="min-w-[2.5rem] text-center text-sm font-semibold">
                      {quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        setQuantity(
                          Math.min(product.stockQuantity, quantity + 1)
                        )
                      }
                      disabled={quantity >= product.stockQuantity}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  {cartQuantity > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({cartQuantity} in cart)
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    size="lg"
                    className="flex-1 font-semibold gap-2"
                    onClick={handleBuyNow}
                    disabled={isAdding || product.stockQuantity === 0}
                  >
                    {product.stockQuantity === 0 ? "Out of Stock" : "Buy Now"}
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="flex-1 font-semibold gap-2"
                    onClick={handleAddToCart}
                    disabled={isAdding || product.stockQuantity === 0}
                  >
                    <ShoppingCart className="size-4" />
                    Add to Cart
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleWishlist}
                  >
                    <Heart className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Trust signals */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <ShieldCheck className="size-4 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    100% Genuine Products
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <Truck className="size-4 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Fast Home Delivery
                  </span>
                </div>
              </div>

              {/* Prescription warning */}
              {product.requiresPrescription && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50 p-4">
                  <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
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
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  About this product
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            </div>
          </div>

          {/* Related products */}
          {relatedProducts && relatedProducts.length > 0 && (
            <div className="mt-16">
              <h2 className="text-xl font-bold tracking-tight text-foreground mb-6">
                Related Products
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {relatedProducts.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
