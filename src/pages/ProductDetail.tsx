import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ShoppingCart,
  Zap,
  Heart,
  ShieldCheck,
  Pill,
  AlertTriangle,
  Truck,
  Package,
  Loader2,
  Info,
  MessageCircle,
  Minus,
  Plus,
  Star,
  TrendingUp,
  PenLine,
} from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/auth-utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { generateProductMessage, openWhatsApp } from "@/lib/whatsapp";

function StarRating({
  rating,
  interactive = false,
  onRate,
  size = "size-5",
}: {
  rating: number;
  interactive?: boolean;
  onRate?: (r: number) => void;
  size?: string;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          className={interactive ? "focus:outline-none transition-transform hover:scale-110" : "cursor-default"}
          onMouseEnter={() => interactive && setHovered(s)}
          onMouseLeave={() => interactive && setHovered(0)}
          onClick={() => interactive && onRate?.(s)}
        >
          <Star
            className={`${size} transition-colors ${
              s <= (interactive ? hovered || rating : rating)
                ? "text-amber-400 fill-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewSheet({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: any;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createReview = useMutation(api.reviews.create);
  const hasReviewed = useQuery(
    api.reviews.hasReviewed,
    product ? { productId: product._id } : "skip"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { toast.error("Please select a star rating"); return; }
    if (!title.trim()) { toast.error("Please enter a title"); return; }
    if (!body.trim()) { toast.error("Please enter your review"); return; }

    setSubmitting(true);
    try {
      await createReview({ productId: product._id, rating, title: title.trim(), body: body.trim() });
      toast.success("Review submitted successfully!");
      setRating(0); setTitle(""); setBody("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => onOpenChange(false)}>
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <SheetTitle className="text-base">Product Review</SheetTitle>
              <SheetDescription className="text-xs">We value your feedback!</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {hasReviewed ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-2xl bg-green-100 flex items-center justify-center mb-4">
                <ShieldCheck className="size-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">Already Reviewed</h3>
              <p className="text-sm text-muted-foreground mt-1">You have already reviewed this product.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product preview */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="size-12 rounded-lg bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] flex items-center justify-center shrink-0 overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="size-full object-contain p-1" />
                  ) : (
                    <Pill className="size-5 text-primary/30" />
                  )}
                </div>
                <p className="text-sm font-medium line-clamp-2">{product.name}</p>
              </div>

              {/* Star rating */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Rating</label>
                <StarRating rating={rating} interactive onRate={setRating} size="size-8" />
                {rating > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {rating === 1 && "Poor"}{rating === 2 && "Fair"}{rating === 3 && "Good"}{rating === 4 && "Very Good"}{rating === 5 && "Excellent"}
                  </p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Review Title</label>
                <Input
                  placeholder="Summarize your experience"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Write about your experience</label>
                <Textarea
                  placeholder="Tell us about this product..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">{body.length}/2000</p>
              </div>
            </form>
          )}
        </div>

        {!hasReviewed && (
          <div className="px-6 py-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="w-full gradient-primary text-white font-semibold rounded-xl h-11"
            >
              {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <PenLine className="size-4 mr-2" />}
              Submit
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const addToCart = useMutation(api.cart.addItem);
  const [whatsappQty, setWhatsappQty] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);

  const product = useQuery(
    api.products.getBySlug,
    slug ? { slug } : "skip"
  );

  const boughtCount = useQuery(
    api.products.boughtInLast7Days,
    product ? { productId: product._id } : "skip"
  );

  const relatedProducts = useQuery(
    api.products.getRelated,
    product
      ? { productId: product._id, categoryId: product.categoryId }
      : "skip"
  );

  const reviews = useQuery(
    api.reviews.listByProduct,
    product ? { productId: product._id } : "skip"
  );

  const avgRating = useQuery(
    api.reviews.getAverageRating,
    product ? { productId: product._id } : "skip"
  );

  const deliveryConfig = useQuery(api.deliveryConfig.getPublic);
  const logWhatsApp = useMutation(api.whatsappEnquiries.log);

  const handleAddToCart = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      toast.error("Please sign in to add items to cart");
      navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    try {
      await addToCart({ productId: product._id, quantity: 1 });
      toast.success("Added to cart");
    } catch (error: any) {
      toast.error(error.message || "Failed to add to cart");
    }
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    navigate("/cart");
  };

  const isWishlisted = useQuery(
    api.wishlist.isWishlisted,
    product ? { productId: product._id } : "skip"
  );
  const toggleWishlist = useMutation(api.wishlist.toggle);

  const handleWishlist = async () => {
    if (!product) return;
    try {
      await toggleWishlist({ productId: product._id });
    } catch (error: any) {
      toast.error(error.message || "Failed to update wishlist");
    }
  };

  const handleWhatsApp = () => {
    if (!product) return;
    const phone = deliveryConfig?.storeWhatsApp || deliveryConfig?.storePhone || "";
    if (!phone) {
      toast.error("WhatsApp number not configured. Please call us directly.");
      return;
    }
    const p = product;
    const hasDiscount = p.discountPrice && p.discountPrice < p.price;
    const unitPrice = hasDiscount ? p.discountPrice! : p.price;
    const isAvailable = p.stockQuantity >= whatsappQty;
    const msg = generateProductMessage({
      productName: p.name,
      price: unitPrice,
      composition: p.composition,
      packSize: p.packSize,
      stockQuantity: p.stockQuantity,
      requestedQuantity: whatsappQty,
      prescriptionRequired: p.prescriptionRequired,
    });
    openWhatsApp(phone, msg);
    logWhatsApp({
      type: "order",
      message: msg,
      summary: `WhatsApp Order — ${p.name} × ${whatsappQty}${isAvailable ? " (Available)" : " (Unavailable)"}`,
      productId: p._id,
      productName: p.name,
      totalAmount: unitPrice * whatsappQty,
      requestedQuantity: whatsappQty,
      available: isAvailable,
      prescriptionRequired: p.prescriptionRequired,
    }).catch(() => {});
  };

  if (product === undefined) {
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

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Pill className="size-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Product Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            The product you're looking for doesn't exist or has been removed.
          </p>
          <Button className="mt-6 font-semibold gradient-primary text-white rounded-xl" onClick={() => navigate("/products")}>
            Browse Medicines
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const p = product;
  const cat = product.category;
  const hasDiscount = p.discountPrice && p.discountPrice < p.price;
  const discountPct = hasDiscount
    ? Math.round(((p.price - p.discountPrice!) / p.price) * 100)
    : 0;
  const isInStock = p.stockQuantity > 0;
  const isLowStock = p.stockQuantity > 0 && p.stockQuantity < 10;
  const totalSold = boughtCount ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors rounded-xl"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {/* Bought recently indicator */}
        {totalSold > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2 text-sm text-primary font-medium"
          >
            <TrendingUp className="size-4" />
            <span>
              <strong className="text-foreground">{totalSold.toLocaleString("en-IN")}</strong> people bought this in the last 7 days
            </span>
          </motion.div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          {/* Product Image */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] flex items-center justify-center h-[300px] sm:h-[400px] overflow-hidden relative">
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="max-h-full max-w-full object-contain p-6"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Pill className="size-24 text-primary/15" />
              )}
              {hasDiscount && (
                <div className="absolute top-4 left-4">
                  <Badge className="text-sm font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
                    {discountPct}% OFF
                  </Badge>
                </div>
              )}
            </div>
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-5"
          >
            {/* Write a Review — near product name */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-sm text-primary hover:text-primary/80 hover:bg-primary/5 rounded-xl"
                onClick={() => {
                  if (!isAuthenticated) {
                    toast.error("Please sign in to write a review");
                    navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);
                    return;
                  }
                  setReviewOpen(true);
                }}
              >
                <PenLine className="size-3.5" />
                Write a Review
              </Button>
              {avgRating && avgRating.count > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <StarRating rating={Math.round(avgRating.average)} size="size-3.5" />
                  <span className="font-medium text-foreground">{avgRating.average}</span>
                  <span>({avgRating.count} {avgRating.count === 1 ? "review" : "reviews"})</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {p.prescriptionRequired ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  Prescription Required
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-green-700 border-green-200 bg-green-50/50">
                  <ShieldCheck className="size-3" />
                  Over the Counter (OTC)
                </Badge>
              )}
              {cat && <Badge variant="secondary">{cat.name}</Badge>}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{p.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                by <span className="font-medium text-foreground">{p.manufacturer}</span>
              </p>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold">{formatCurrency(hasDiscount ? p.discountPrice! : p.price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{formatCurrency(p.price)}</span>
                  <Badge className="bg-green-100 text-green-700 border-green-200 font-bold">
                    Save {formatCurrency(p.price - p.discountPrice!)}
                  </Badge>
                </>
              )}
            </div>

            <div>
              {isInStock ? (
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${isLowStock ? "bg-amber-500" : "bg-green-500"}`} />
                  <span className={`text-sm font-medium ${isLowStock ? "text-amber-600" : "text-green-600"}`}>
                    {isLowStock ? `Only ${p.stockQuantity} left in stock` : "In Stock"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-red-600">Out of Stock</span>
                </div>
              )}
            </div>

            {p.prescriptionRequired && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Prescription Required</p>
                  <p className="text-xs text-amber-700 mt-1">
                    This medicine requires a valid prescription from a registered medical practitioner.
                    Please upload your prescription during checkout.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 h-12 text-sm font-semibold gap-2 gradient-primary text-white shadow-glow hover:shadow-card-hover transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl"
                onClick={handleAddToCart}
                disabled={!isInStock}
              >
                <ShoppingCart className="size-4" />
                {isInStock ? "Add to Cart" : "Out of Stock"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 text-sm font-semibold gap-2 rounded-xl"
                onClick={handleBuyNow}
                disabled={!isInStock}
              >
                <Zap className="size-4" />
                Buy Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={`h-12 w-12 rounded-xl ${isWishlisted ? "bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100" : ""}`}
                onClick={handleWishlist}
              >
                <Heart className={`size-4 ${isWishlisted ? "fill-rose-500" : ""}`} />
              </Button>
            </div>

            {/* WhatsApp Quantity Selector */}
            {isInStock && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Qty for WhatsApp:</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-lg"
                    onClick={() => setWhatsappQty(Math.max(1, whatsappQty - 1))}
                    disabled={whatsappQty <= 1}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="text-sm font-semibold w-8 text-center">{whatsappQty}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 rounded-lg"
                    onClick={() => setWhatsappQty(Math.min(p.stockQuantity, whatsappQty + 1))}
                    disabled={whatsappQty >= p.stockQuantity}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>
            )}

            <Button
              size="lg"
              variant="outline"
              className="w-full h-11 text-sm font-semibold gap-2 rounded-xl border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="size-4" />
              Order on WhatsApp{whatsappQty > 1 ? ` (${whatsappQty}×)` : ""}
            </Button>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                100% Genuine
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="size-3.5 text-primary" />
                Fast Delivery
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="size-3.5 text-primary" />
                Secure Packaging
              </div>
            </div>

            <Card className="border-border/60">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead colSpan={2} className="text-sm font-bold">
                        Product Details
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.composition && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Composition</TableCell>
                        <TableCell>{p.composition}</TableCell>
                      </TableRow>
                    )}
                    {p.strength && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Strength</TableCell>
                        <TableCell>{p.strength}</TableCell>
                      </TableRow>
                    )}
                    {p.form && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Form</TableCell>
                        <TableCell className="capitalize">{p.form}</TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">Pack Size</TableCell>
                      <TableCell>{p.packSize}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">Manufacturer</TableCell>
                      <TableCell>{p.manufacturer}</TableCell>
                    </TableRow>
                    {p.sku && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">SKU</TableCell>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      </TableRow>
                    )}
                    {cat && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Category</TableCell>
                        <TableCell>{cat.name}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Description + Benefits + Storage */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12 grid gap-6 lg:grid-cols-2"
        >
          <Card className="border-border/60">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-3">Description</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
            </CardContent>
          </Card>
          {p.benefits && (
            <Card className="border-border/60">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  Benefits
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.benefits}</p>
              </CardContent>
            </Card>
          )}
          {p.storageInformation && (
            <Card className="border-border/60">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <Info className="size-4 text-primary" />
                  Storage Information
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.storageInformation}</p>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Customer Reviews */}
        {reviews && reviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-12"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Customer Reviews</h3>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-primary"
                onClick={() => {
                  if (!isAuthenticated) {
                    toast.error("Please sign in to write a review");
                    navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);
                    return;
                  }
                  setReviewOpen(true);
                }}
              >
                <PenLine className="size-3.5" />
                Write a Review
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {reviews.map((review) => (
                <Card key={review._id} className="border-border/60">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {review.userInitial}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{review.userName}</p>
                          <StarRating rating={review.rating} size="size-3" />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold">{review.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {relatedProducts && relatedProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <h3 className="text-xl font-bold mb-6">Related Products</h3>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {relatedProducts.map((rp) => {
                const hasDisc = rp.discountPrice && rp.discountPrice < rp.price;
                return (
                  <div
                    key={rp._id}
                    className="group rounded-2xl border border-border/70 bg-card p-4 cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1"
                    onClick={() => navigate(`/products/${rp.slug}`)}
                  >
                    <div className="flex items-center justify-center bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] h-28 rounded-xl mb-3 overflow-hidden">
                      {rp.imageUrl ? (
                        <img src={rp.imageUrl} alt={rp.name} className="max-h-full max-w-full object-contain p-2" />
                      ) : (
                        <Pill className="size-8 text-primary/20" />
                      )}
                    </div>
                    <h4 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{rp.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{rp.manufacturer}</p>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-base font-extrabold">{formatCurrency(hasDisc ? rp.discountPrice! : rp.price)}</span>
                      {hasDisc && (
                        <span className="text-xs text-muted-foreground line-through">{formatCurrency(rp.price)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </main>

      {/* Review Sheet */}
      <ReviewSheet open={reviewOpen} onOpenChange={setReviewOpen} product={product} />

      <Footer />
    </div>
  );
}
