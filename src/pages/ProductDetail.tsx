import { useParams, useNavigate, useLocation } from "react-router";
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
  Share2,
  Link2,
  Mail,
  Copy,
  ExternalLink,
  Shield,
  CreditCard,
  Calendar,
  BookOpen,
  Stethoscope,
  ClipboardList,
  HelpCircle,
  Search,
} from "lucide-react";
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  const location = useLocation();
  const backTo = (location.state as any)?.from || "/products";
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const { isAuthenticated } = useAuth();
  const addToCart = useMutation(api.cart.addItem);
  const [whatsappQty, setWhatsappQty] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [purchasersOpen, setPurchasersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("product-info");

  const product = useQuery(
    api.products.getBySlug,
    slug ? { slug } : "skip"
  );

  const boughtCount = useQuery(
    api.products.boughtInLast7Days,
    product ? { productId: product._id } : "skip"
  );

  const recentPurchasers = useQuery(
    api.products.getRecentPurchasers,
    purchasersOpen && product ? { productId: product._id } : "skip"
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

  const hasVariants = !!(product && (product as any).packSizeVariants && (product as any).packSizeVariants.length > 0);
  const activeVariant = hasVariants ? (product as any).packSizeVariants[selectedVariantIndex] : null;
  const activePrice = activeVariant ? activeVariant.price : (product?.discountPrice && product.discountPrice < (product?.price ?? 0) ? product.discountPrice! : product?.price ?? 0);
  const activeOriginalPrice = activeVariant ? (activeVariant.discountPrice && activeVariant.discountPrice < activeVariant.price ? activeVariant.price : activeVariant.price) : product?.price ?? 0;
  const activeDiscount = activeVariant?.discountPrice && activeVariant.discountPrice < activeVariant.price ? activeVariant : null;
  const activeStock = activeVariant ? activeVariant.stockQuantity : (product?.stockQuantity ?? 0);
  const activePackLabel = activeVariant ? activeVariant.label : (product?.packSize ?? "");

  const handleAddToCart = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      toast.error("Please sign in to add items to cart");
      navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    try {
      await addToCart({ productId: product._id, quantity: 1 });
      toast.success(`Added to cart${activeVariant ? ` (${activeVariant.label})` : ""}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to add to cart");
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (!isAuthenticated) {
      toast.error("Please sign in to buy now");
      navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    navigate(`/checkout?buyNow=${product._id}${activeVariant ? `&variant=${selectedVariantIndex}` : ""}`);
  };

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: product?.name || "Product",
        text: `Check out ${product?.name} on Kalyan Chemist`,
        url: shareUrl,
      }).catch(() => {});
    }
  }, [product?.name, shareUrl]);

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
    const unitPrice = activeDiscount ? activeDiscount.discountPrice! : activePrice;
    const isAvailable = activeStock >= whatsappQty;
    const msg = generateProductMessage({
      productName: p.name,
      price: unitPrice,
      composition: p.composition,
      packSize: activePackLabel,
      stockQuantity: activeStock,
      requestedQuantity: whatsappQty,
      prescriptionRequired: p.prescriptionRequired,
    });
    openWhatsApp(phone, msg);
    logWhatsApp({
      type: "order",
      message: msg,
      summary: `WhatsApp Order — ${p.name}${activeVariant ? ` (${activeVariant.label})` : ""} × ${whatsappQty}${isAvailable ? " (Available)" : " (Unavailable)"}`,
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
  const allImages: string[] = [
    ...(p.imageUrl ? [p.imageUrl] : []),
    ...((p as any).additionalImages || []).filter((img: string) => img && img !== p.imageUrl),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors rounded-xl"
          onClick={() => navigate(backTo)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {/* Bought recently indicator — clickable */}
        {totalSold > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <button
              type="button"
              onClick={() => setPurchasersOpen(true)}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors cursor-pointer group"
            >
              <TrendingUp className="size-4" />
              <span>
                <strong className="text-foreground group-hover:text-primary transition-colors">{totalSold.toLocaleString("en-IN")}</strong> people bought this in the last 7 days
              </span>
              <span className="text-xs text-muted-foreground group-hover:text-primary/60">(view)</span>
            </button>
          </motion.div>
        )}

        {/* Recent Purchasers Dialog */}
        <Dialog open={purchasersOpen} onOpenChange={setPurchasersOpen}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                Recent Purchasers
              </DialogTitle>
              <DialogDescription>
                Customers who purchased this product in the last 7 days
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-2">
              {recentPurchasers === undefined ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : recentPurchasers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <TrendingUp className="size-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No recent purchases yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPurchasers.map((p, idx) => (
                    <div
                      key={`${p.customerName}-${idx}`}
                      className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {p.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{p.customerName}</p>
                            <p className="text-xs text-muted-foreground">
                              Purchased: {new Date(p.purchaseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5">
                          Qty: {p.quantity}
                        </span>
                      </div>
                      {p.review && (
                        <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                          <div className="flex items-center gap-2">
                            <StarRating rating={p.review.rating} size="size-3.5" />
                            <span className="text-xs text-muted-foreground">
                              Reviewed: {new Date(p.review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          {p.review.title && (
                            <p className="text-xs font-medium text-foreground">{p.review.title}</p>
                          )}
                          {p.review.body && (
                            <p className="text-xs text-muted-foreground leading-relaxed">&ldquo;{p.review.body}&rdquo;</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          {/* Product Image Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex gap-3 items-start">
              {/* Thumbnails — vertical on desktop, horizontal on mobile */}
              {allImages.length > 1 && (
                <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible shrink-0">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImage(idx)}
                      className={`size-16 sm:size-18 lg:size-20 rounded-xl border-2 overflow-hidden shrink-0 transition-all duration-200 bg-gradient-to-br from-primary/[0.03] to-primary/[0.01] flex items-center justify-center cursor-pointer ${
                        selectedImage === idx
                          ? "border-primary shadow-md ring-1 ring-primary/20"
                          : "border-border/50 hover:border-primary/40 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${p.name} view ${idx + 1}`}
                        className="size-full object-contain p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Main image */}
              <div className="flex-1 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] flex items-center justify-center h-[300px] sm:h-[400px] overflow-hidden relative">
                {allImages.length > 0 ? (
                  <img
                    src={allImages[selectedImage] || allImages[0]}
                    alt={p.name}
                    className="max-h-full max-w-full object-contain p-6 transition-opacity duration-300"
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

            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{p.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  by <span className="font-medium text-foreground">{p.manufacturer}</span>
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 size-12 rounded-full border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all"
                onClick={() => setShareOpen(true)}
                title="Share this product"
              >
                <Share2 className="size-5" />
              </Button>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold">{formatCurrency(activeDiscount ? activeDiscount.discountPrice! : activePrice)}</span>
              {activeDiscount && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{formatCurrency(activeDiscount.price)}</span>
                  <Badge className="bg-green-100 text-green-700 border-green-200 font-bold">
                    Save {formatCurrency(activeDiscount.price - activeDiscount.discountPrice!)}
                  </Badge>
                </>
              )}
            </div>

            {/* Pack Size Variants Selector */}
            {hasVariants && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Selected Pack Size: <span className="text-primary">{activePackLabel}</span></p>
                <div className="flex flex-wrap gap-2">
                  {(product as any).packSizeVariants.map((variant: any, i: number) => {
                    const vDiscount = variant.discountPrice && variant.discountPrice < variant.price;
                    const vInStock = variant.stockQuantity > 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!vInStock}
                        onClick={() => setSelectedVariantIndex(i)}
                        className={`relative flex flex-col items-start p-3 rounded-xl border-2 transition-all duration-200 min-w-[100px] ${
                          selectedVariantIndex === i
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : vInStock
                            ? "border-border/60 hover:border-primary/30 hover:bg-muted/30"
                            : "border-border/30 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <span className="text-sm font-semibold text-foreground">{variant.label}</span>
                        <span className="text-sm font-bold mt-1">{formatCurrency(vDiscount ? variant.discountPrice! : variant.price)}</span>
                        {vDiscount && (
                          <span className="text-xs text-muted-foreground line-through">{formatCurrency(variant.price)}</span>
                        )}
                        <span className={`text-xs mt-1 font-medium ${vInStock ? "text-green-600" : "text-red-500"}`}>
                          {vInStock ? "In Stock" : "Out of Stock"}
                        </span>
                        {selectedVariantIndex === i && (
                          <div className="absolute top-1.5 right-1.5 size-4 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-[8px] text-white font-bold">✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              {activeStock > 0 ? (
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${activeStock < 10 ? "bg-amber-500" : "bg-green-500"}`} />
                  <span className={`text-sm font-medium ${activeStock < 10 ? "text-amber-600" : "text-green-600"}`}>
                    {activeStock < 10 ? `Only ${activeStock} left in stock` : "In Stock"}
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
                onClick={handleBuyNow}
                disabled={activeStock <= 0}
              >
                <Zap className="size-4" />
                Buy Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 text-sm font-semibold gap-2 rounded-xl"
                onClick={handleAddToCart}
                disabled={activeStock <= 0}
              >
                <ShoppingCart className="size-4" />
                {isInStock ? "Add to Cart" : "Out of Stock"}
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
            {activeStock > 0 && (
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
                    onClick={() => setWhatsappQty(Math.min(activeStock, whatsappQty + 1))}
                    disabled={whatsappQty >= activeStock}
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

            <div className="flex flex-wrap gap-6 pt-1">
              <div className="flex flex-col items-center text-center gap-1">
                <Truck className="size-7 text-slate-700" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground">Fast Delivery</span>
                <span className="text-[11px] text-muted-foreground">Same day dispatch</span>
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <Package className="size-7 text-slate-700" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground">Secure Packaging</span>
                <span className="text-[11px] text-muted-foreground">Sealed & protected</span>
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <ShieldCheck className="size-7 text-slate-700" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground">Trusted Pharmacy</span>
                <span className="text-[11px] text-muted-foreground">Licensed & verified</span>
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
                    {p.expiryDate && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Expires On or After</TableCell>
                        <TableCell className="text-green-700 font-medium">
                          {new Date(p.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        </TableCell>
                      </TableRow>
                    )}
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
                    {(p.consumeType || p.form) && (
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">Consume Type</TableCell>
                        <TableCell>{
                          p.consumeType || (
                            ["tablet", "capsule", "syrup", "suspension", "drops", "inhaler", "powder", "sachet"].includes((p.form || "").toLowerCase())
                              ? "For oral use"
                              : ["cream", "gel", "ointment", "lotion"].includes((p.form || "").toLowerCase())
                              ? "For external use only"
                              : p.form === "injection"
                              ? "For injection use only"
                              : `For ${p.form} use`
                          )
                        }</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Section Navigation Tabs — Premium Design */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
          className="mt-10"
        >
          {/* Tab bar container */}
          <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Row 1: tabs + trust indicators */}
            <div className="flex flex-wrap items-center gap-x-1 lg:gap-x-2 gap-y-1 px-2 pt-2">
              <div className="flex flex-wrap gap-x-1 lg:gap-x-1.5">
                {(
                  [
                    { id: "product-info", label: "Product Information", icon: BookOpen },
                    { id: "medical-benefits", label: "Medical Benefits", icon: Stethoscope },
                    { id: "key-ingredients", label: "Key Ingredients", icon: Pill },
                    { id: "directions-for-use", label: "Directions for Use", icon: ClipboardList },
                    { id: "safety", label: "Safety", icon: ShieldCheck },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id);
                        document.getElementById(tab.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={`relative flex items-center gap-1.5 py-2.5 px-3 text-[11px] sm:text-xs font-semibold tracking-wide uppercase rounded-xl transition-all duration-200 ease-out group ${
                        isActive
                          ? "bg-primary/15 text-primary shadow-[0_0_0_1.5px_rgba(var(--primary-rgb,59,130,246),0.2),0_1px_3px_-1px_rgba(0,0,0,0.08)] scale-[1.02]"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:shadow-[0_1px_4px_-1px_rgba(0,0,0,0.08)] hover:scale-[1.02] active:scale-[0.97]"
                      }`}
                    >
                      <Icon className={`size-3.5 transition-all duration-200 ${isActive ? "text-primary scale-110" : "text-muted-foreground/60 group-hover:text-foreground group-hover:scale-110"}`} strokeWidth={isActive ? 2 : 1.5} />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                      {isActive && (
                        <motion.span
                          layoutId="activeTabIndicator"
                          className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/[0.08]"
                          transition={{ type: "spring", stiffness: 500, damping: 32 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Trust indicators */}
              <div className="hidden lg:flex items-center gap-5 ml-6 pl-5 border-l border-border/40">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Shield className="size-7 text-slate-700" strokeWidth={1.5} />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-foreground leading-tight">100% Genuine</span>
                    <span className="text-[9px] text-muted-foreground leading-tight">Products</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Calendar className="size-7 text-slate-700" strokeWidth={1.5} />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-foreground leading-tight">Expiry After</span>
                    <span className="text-[9px] text-muted-foreground leading-tight">{p.expiryDate ? new Date(p.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <CreditCard className="size-7 text-slate-700" strokeWidth={1.5} />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-foreground leading-tight">Safe & Secure</span>
                    <span className="text-[9px] text-muted-foreground leading-tight">Payments</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: remaining tabs */}
            <div className="flex flex-wrap gap-x-1 lg:gap-x-1.5 px-2 pb-2 pt-1">
              {(
                [
                  { id: "information", label: "Information", icon: Info },
                  { id: "faqs", label: "FAQs", icon: HelpCircle },
                  { id: "customers-also-bought", label: "Customers Also Bought", icon: ShoppingCart },
                  { id: "other-links", label: "Other Links", icon: Link2 },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      document.getElementById(tab.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={`relative flex items-center gap-1.5 py-2.5 px-3 text-[11px] sm:text-xs font-semibold tracking-wide uppercase rounded-xl transition-all duration-200 ease-out group ${
                      isActive
                        ? "bg-primary/15 text-primary shadow-[0_0_0_1.5px_rgba(var(--primary-rgb,59,130,246),0.2),0_1px_3px_-1px_rgba(0,0,0,0.08)] scale-[1.02]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:shadow-[0_1px_4px_-1px_rgba(0,0,0,0.08)] hover:scale-[1.02] active:scale-[0.97]"
                    }`}
                  >
                    <Icon className={`size-3.5 transition-all duration-200 ${isActive ? "text-primary scale-110" : "text-muted-foreground/60 group-hover:text-foreground group-hover:scale-110"}`} strokeWidth={isActive ? 2 : 1.5} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                    {isActive && (
                      <motion.span
                        layoutId="activeTabIndicator2"
                        className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/[0.08]"
                        transition={{ type: "spring", stiffness: 500, damping: 32 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile trust indicators */}
            <div className="flex lg:hidden flex-wrap items-center gap-4 px-4 pb-3 pt-1 justify-center border-t border-border/30">
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-slate-700" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-foreground">100% Genuine</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="size-5 text-slate-700" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-foreground">Expiry {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="size-5 text-slate-700" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold text-foreground">Secure Payments</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Product Information ── */}
        <motion.div id="product-info" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center"><BookOpen className="size-4 text-primary" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Product Information</h3>
          </div>
          <Card className="border-border/60 transition-all duration-300 hover:shadow-md hover:border-primary/15">
            <CardContent className="p-6 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {p.description || (
                  <>
                    <strong>{p.name}</strong> is a {p.form || "medication"} manufactured by <strong>{p.manufacturer}</strong>.
                    {p.composition ? <> It contains <strong>{p.composition}</strong> as its active {p.composition.split("+").length > 1 ? "ingredients" : "ingredient"}.</> : ""}
                    {p.strength ? <> The strength of this product is {p.strength}.</> : ""}
                    <> It comes in a {p.packSize} pack and is available at Kalyan Chemist.</>
                  </>
                )}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Therapeutic Category</p>
                  <p className="text-sm text-muted-foreground">{cat?.name || "General medicine"}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Primary Use</p>
                  <p className="text-sm text-muted-foreground">{p.benefits ? p.benefits.split(". ")[0]?.trim().replace(/\.$/, "") || "Therapeutic use" : "Please refer to the composition and consult your healthcare provider for specific therapeutic applications."}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Dosage Form</p>
                  <p className="text-sm text-muted-foreground capitalize">{p.form ? `${p.form} (${p.consumeType || "as directed"})` : p.consumeType || "As directed by physician"}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Availability</p>
                  <p className="text-sm text-muted-foreground">Available at Kalyan Chemist — online ordering with fast home delivery across serviceable areas.</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This product is intended for {p.prescriptionRequired ? "prescription-based use" : "general consumer use"} and should be taken as recommended. Always check the packaging for detailed instructions specific to your batch. For further guidance on suitability or usage duration, consult your physician or pharmacist.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Medical Benefits ── */}
        <motion.div id="medical-benefits" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-green-100 flex items-center justify-center"><Stethoscope className="size-4 text-green-600" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Medical Benefits</h3>
          </div>
          <Card className="border-border/60 transition-all duration-300 hover:shadow-md hover:border-primary/15">
            <CardContent className="p-6 space-y-4">
              {p.benefits ? (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {p.name} is formulated to provide targeted therapeutic relief. The active {p.composition?.split("+").length === 1 ? "ingredient" : "ingredients"}{p.composition ? ` (${p.composition})` : ""} work together to deliver effective and reliable results for the intended therapeutic use.
                  </p>
                  <div className="space-y-3">
                    {p.benefits.split(". ").filter(Boolean).map((sentence, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-green-50/50 border border-green-100/60 transition-all duration-300 hover:bg-green-50 hover:shadow-sm">
                        <div className="size-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-green-600">{i + 1}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-green-900/80">{sentence.trim().replace(/\.$/, "")}.</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground italic pt-1">Disclaimer: Benefits described are based on the known pharmacological properties of the active ingredients. Results may vary. Always follow your physician's advice for the best therapeutic outcome.</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">Detailed medical benefits are not available for this product. Please consult your healthcare provider for information about its therapeutic use.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Key Ingredients ── */}
        <motion.div id="key-ingredients" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-violet-100 flex items-center justify-center"><Pill className="size-4 text-violet-600" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Key Ingredients</h3>
          </div>
          <Card className="border-border/60 transition-all duration-300 hover:shadow-md hover:border-primary/15">
            <CardContent className="p-6 space-y-4">
              {p.composition ? (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    The therapeutic action of {p.name} is driven by the following active {p.composition.split("+").length > 1 ? "ingredients" : "ingredient"}. Each component is carefully selected for its proven efficacy in the intended therapeutic area.
                  </p>
                  <div className="space-y-3">
                    {p.composition.split("+").map((comp, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-primary/[0.03] border border-primary/10 transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Pill className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{comp.trim()}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Active component contributing to the therapeutic effect of this product.</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {p.strength && <p className="text-xs text-muted-foreground">Each unit contains a strength of {p.strength}, as specified by the manufacturer.</p>}
                  <p className="text-xs text-muted-foreground italic">Inactive ingredients may include excipients, binders, and coating agents as specified on the product packaging. Please refer to the label for a complete list.</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">Detailed ingredient information is not available for this product. Please check the product packaging or consult your pharmacist.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Directions for Use ── */}
        <motion.div id="directions-for-use" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-blue-100 flex items-center justify-center"><ClipboardList className="size-4 text-blue-600" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Directions for Use</h3>
          </div>
          <Card className="border-border/60 transition-all duration-300 hover:shadow-md hover:border-primary/15">
            <CardContent className="p-6 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {p.consumeType || (p.form ? `${p.name} is a ${p.form} formulation designed for therapeutic use.` : `${p.name} is a therapeutic product.`)}
                {' '}Follow the dosage schedule recommended by your physician or as indicated on the product label.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/60 transition-all duration-300 hover:bg-blue-50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-blue-700 mb-1">How to Take</p>
                  <p className="text-sm text-blue-900/80">{p.form === "syrup" || p.form === "suspension" ? `Measure the dose using the provided measuring cup or syringe. Do not use a household spoon.` : p.form === "cream" || p.form === "gel" || p.form === "ointment" ? `Apply a thin, even layer to the affected area. Gently massage until absorbed. Wash hands before and after application.` : p.form === "drops" ? `Instill the recommended number of drops into the affected area as directed.` : `Swallow the ${p.form || "tablet"} with a glass of water. Take after a meal or as directed by your physician.`}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/60 transition-all duration-300 hover:bg-blue-50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Timing</p>
                  <p className="text-sm text-blue-900/80">Take at regular intervals as prescribed. If you miss a dose, take it as soon as you remember unless it is almost time for the next dose. Do not double the dose to make up for a missed one.</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/60 transition-all duration-300 hover:bg-blue-50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Duration</p>
                  <p className="text-sm text-blue-900/80">Complete the full course of treatment as advised by your physician, even if symptoms improve early. Stopping a prescription medication prematurely may reduce its effectiveness.</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/60 transition-all duration-300 hover:bg-blue-50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Important</p>
                  <p className="text-sm text-blue-900/80">{p.prescriptionRequired ? `Do not self-medicate. This product requires a valid prescription and should only be used under medical supervision.` : `While this product is available without a prescription, it is recommended to consult your healthcare provider before starting any new medication.`}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">These directions are general guidelines. Always follow the specific instructions provided by your physician or on the product label.</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Safety ── */}
        <motion.div id="safety" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-amber-100 flex items-center justify-center"><ShieldCheck className="size-4 text-amber-600" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Safety</h3>
          </div>
          <Card className="border-border/60 transition-all duration-300 hover:shadow-md hover:border-primary/15">
            <CardContent className="p-6 space-y-4">
              {p.safetyNote && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 transition-all duration-300 hover:bg-amber-100/50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Manufacturer Safety Note</p>
                  <p className="text-sm text-amber-900/80 leading-relaxed">{p.safetyNote}</p>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-red-50/50 border border-red-100/60 transition-all duration-300 hover:bg-red-50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-red-700 mb-1">Storage</p>
                  <p className="text-sm text-red-900/80">{p.storageInformation || `Store below 30°C in a dry place, away from direct sunlight and moisture. Keep out of reach of children.`}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50/50 border border-red-100/60 transition-all duration-300 hover:bg-red-50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-red-700 mb-1">Expiry Warning</p>
                  <p className="text-sm text-red-900/80">Do not use after the expiry date printed on the packaging. Expired medications may lose their effectiveness and can pose health risks. Discard safely.</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50/50 border border-red-100/60 transition-all duration-300 hover:bg-red-50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-red-700 mb-1">Allergic Reactions</p>
                  <p className="text-sm text-red-900/80">Before taking {p.name}, check the ingredient list for any known allergies. If you develop rashes, swelling, difficulty breathing, or any unusual symptoms, stop using immediately and seek emergency medical help.</p>
                </div>
                <div className="p-3 rounded-xl bg-red-50/50 border border-red-100/60 transition-all duration-300 hover:bg-red-50 hover:shadow-sm">
                  <p className="text-xs font-semibold text-red-700 mb-1">Special Precautions</p>
                  <p className="text-sm text-red-900/80">{p.prescriptionRequired ? `This is a prescription medication. Do not share it with others or use it without medical supervision. Inform your physician of all medications you are currently taking to avoid potential interactions.` : `While this is an over-the-counter product, it is not a substitute for professional medical advice. Consult your doctor if symptoms persist beyond the recommended duration.`}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">Always read the product leaflet/packaging for comprehensive safety information specific to your batch. Report any adverse events to your healthcare provider.</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Information ── */}
        <motion.div id="information" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center"><Info className="size-4 text-slate-600" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Information</h3>
          </div>
          <Card className="border-border/60 transition-all duration-300 hover:shadow-md hover:border-primary/15">
            <CardContent className="p-6 space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Below you will find additional ordering, delivery, and availability details for {p.name}. This information is separate from the product specifications shown above.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Ordering</p>
                  <p className="text-sm text-muted-foreground">Order online from Kalyan Chemist for reliable home delivery. You can also place orders via WhatsApp for a quick and convenient experience.</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Delivery</p>
                  <p className="text-sm text-muted-foreground">Available for delivery in all serviceable areas. Check your pincode at checkout to confirm delivery availability and estimated delivery time.</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Payment Options</p>
                  <p className="text-sm text-muted-foreground">Pay securely online via UPI, credit/debit cards, net banking, or choose Cash on Delivery (COD) where available.</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Customer Support</p>
                  <p className="text-sm text-muted-foreground">Questions about this product? Reach out to our pharmacy team via WhatsApp or phone. Our experts are happy to help.</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Authenticity</p>
                  <p className="text-sm text-muted-foreground">All products are sourced directly from {p.manufacturer || "the manufacturer"} or authorized distributors. Kalyan Chemist guarantees 100% authenticity.</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/[0.03] transition-all duration-300 hover:bg-primary/[0.06] hover:shadow-sm">
                  <p className="text-xs font-semibold text-primary mb-1">Returns</p>
                  <p className="text-sm text-muted-foreground">{p.prescriptionRequired ? `Prescription medications are non-returnable once delivered. Please verify the product upon delivery.` : `Products in sealed, unopened condition may be eligible for return as per our return policy.`}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── FAQs ── */}
        <motion.div id="faqs" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-cyan-100 flex items-center justify-center"><HelpCircle className="size-4 text-cyan-600" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Frequently Asked Questions</h3>
          </div>
          <div className="space-y-3">
            <Card className="border-border/60 transition-all duration-300 hover:shadow-sm hover:border-primary/15 cursor-pointer"><CardContent className="p-5 space-y-1"><p className="text-sm font-semibold">Is {p.name} genuine at Kalyan Chemist?</p><p className="text-sm text-muted-foreground">Absolutely. Every unit of {p.name} is sourced directly from {p.manufacturer} or their authorized distributors. We maintain strict supply chain integrity, and each product goes through quality checks before dispatch.</p></CardContent></Card>
            <Card className="border-border/60 transition-all duration-300 hover:shadow-sm hover:border-primary/15 cursor-pointer"><CardContent className="p-5 space-y-1"><p className="text-sm font-semibold">{p.prescriptionRequired ? `Do I need a prescription for ${p.name}?` : `Can I buy ${p.name} without a prescription?`}</p><p className="text-sm text-muted-foreground">{p.prescriptionRequired ? `Yes, ${p.name} is a prescription-only medicine (Rx). A valid prescription from a registered medical practitioner is mandatory for purchase. You can upload your prescription during checkout, and our pharmacist will verify it before processing your order.` : `${p.name} is available as an over-the-counter (OTC) product and can be purchased directly without a prescription. However, we recommend consulting your physician for personalised dosage guidance.`}</p></CardContent></Card>
            <Card className="border-border/60 transition-all duration-300 hover:shadow-sm hover:border-primary/15 cursor-pointer"><CardContent className="p-5 space-y-1"><p className="text-sm font-semibold">How long does delivery take for {p.name}?</p><p className="text-sm text-muted-foreground">Delivery times depend on your location. Orders within Kalyan Chemist's serviceable areas are typically delivered within the estimated timeframe shown at checkout. Same-day dispatch is available for orders placed before the cut-off time.</p></CardContent></Card>
            <Card className="border-border/60 transition-all duration-300 hover:shadow-sm hover:border-primary/15 cursor-pointer"><CardContent className="p-5 space-y-1"><p className="text-sm font-semibold">What if {p.name} is out of stock?</p><p className="text-sm text-muted-foreground">If {p.name} is temporarily unavailable, you can place an enquiry via WhatsApp and we will notify you as soon as it is restocked. Our pharmacy team can also suggest suitable alternatives where appropriate.</p></CardContent></Card>
            <Card className="border-border/60 transition-all duration-300 hover:shadow-sm hover:border-primary/15 cursor-pointer"><CardContent className="p-5 space-y-1"><p className="text-sm font-semibold">Can I track my order for {p.name}?</p><p className="text-sm text-muted-foreground">Yes. Once your order is confirmed, you will receive real-time order status updates through your Kalyan Chemist account. You can also reach out via WhatsApp for order assistance.</p></CardContent></Card>
            <Card className="border-border/60 transition-all duration-300 hover:shadow-sm hover:border-primary/15 cursor-pointer"><CardContent className="p-5 space-y-1"><p className="text-sm font-semibold">{p.prescriptionRequired ? `Can I share the prescription after placing the order?` : `Is there a limit on how many units I can order?`}</p><p className="text-sm text-muted-foreground">{p.prescriptionRequired ? `Yes. You can upload a valid prescription during checkout or share it via WhatsApp. Our pharmacist will verify the prescription before your order is dispatched. Orders without a verified prescription will not be processed.` : `There is no strict limit for personal use. However, bulk orders may require additional verification. Contact our team via WhatsApp for large quantity orders.`}</p></CardContent></Card>
          </div>
        </motion.div>

        {/* ── Customers Also Bought ── */}
        <motion.div id="customers-also-bought" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-rose-100 flex items-center justify-center"><ShoppingCart className="size-4 text-rose-600" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Customers Also Bought</h3>
          </div>
          {relatedProducts && relatedProducts.length > 0 ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {relatedProducts.map((rp) => {
                const hasDisc = rp.discountPrice && rp.discountPrice < rp.price;
                return (
                  <div
                    key={rp._id}
                    className="group rounded-2xl border border-border/70 bg-card p-4 cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1"
                    onClick={() => navigate(`/products/${rp.slug}`, { state: { from: backTo } })}
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
          ) : (
            <p className="text-sm text-muted-foreground italic">No related products available.</p>
          )}
        </motion.div>

        {/* ── Other Links ── */}
        <motion.div id="other-links" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }} className="mt-8 mb-8 scroll-mt-24">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-indigo-100 flex items-center justify-center"><Link2 className="size-4 text-indigo-600" strokeWidth={1.5} /></div>
            <h3 className="text-lg font-bold">Other Links</h3>
          </div>
          <Card className="border-border/60">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-3">
                {cat && (
                  <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => navigate(`/category/${cat.slug}`)}>
                    Browse {cat.name}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => navigate("/products")}>
                  All Medicines
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => navigate("/")}>
                  Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Share this product</DialogTitle>
            <DialogDescription className="text-xs">Let others know about {p.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-3 py-2">
            {/* WhatsApp */}
            <button
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-green-50 transition-colors"
              onClick={() => {
                const text = encodeURIComponent(`Check out ${p.name} on Kalyan Chemist\n${shareUrl}`);
                window.open(`https://wa.me/?text=${text}`, "_blank");
              }}
            >
              <div className="size-11 rounded-full bg-green-500 flex items-center justify-center">
                <MessageCircle className="size-5 text-white" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">WhatsApp</span>
            </button>

            {/* Facebook */}
            <button
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-blue-50 transition-colors"
              onClick={() => {
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
              }}
            >
              <div className="size-11 rounded-full bg-[#1877F2] flex items-center justify-center">
                <svg className="size-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Facebook</span>
            </button>

            {/* Instagram */}
            <button
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-pink-50 transition-colors"
              onClick={handleCopyLink}
            >
              <div className="size-11 rounded-full bg-gradient-to-br from-[#FFDC80] via-[#E1306C] to-[#833AB4] flex items-center justify-center">
                <svg className="size-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Instagram</span>
            </button>

            {/* X / Twitter */}
            <button
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              onClick={() => {
                const text = encodeURIComponent(`Check out ${p.name} on Kalyan Chemist`);
                window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
              }}
            >
              <div className="size-11 rounded-full bg-black flex items-center justify-center">
                <svg className="size-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">X</span>
            </button>

            {/* Email */}
            <button
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-amber-50 transition-colors"
              onClick={() => {
                const subject = encodeURIComponent(`Check out ${p.name}`);
                const body = encodeURIComponent(`I found this product on Kalyan Chemist and thought you might be interested:\n\n${p.name} — ${formatCurrency(activeDiscount ? activeDiscount.discountPrice! : activePrice)}\n\n${shareUrl}`);
                window.open(`mailto:?subject=${subject}&body=${body}`);
              }}
            >
              <div className="size-11 rounded-full bg-amber-500 flex items-center justify-center">
                <Mail className="size-5 text-white" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Email</span>
            </button>

            {/* Copy Link */}
            <button
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-primary/5 transition-colors"
              onClick={handleCopyLink}
            >
              <div className="size-11 rounded-full bg-primary flex items-center justify-center">
                {copied ? <Copy className="size-5 text-white" /> : <Link2 className="size-5 text-white" />}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{copied ? "Copied!" : "Copy Link"}</span>
            </button>

            {/* Native Share */}
            {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
              <button
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-purple-50 transition-colors"
                onClick={handleNativeShare}
              >
                <div className="size-11 rounded-full bg-purple-600 flex items-center justify-center">
                  <ExternalLink className="size-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">More</span>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Sheet */}
      <ReviewSheet open={reviewOpen} onOpenChange={setReviewOpen} product={product} />

      <Footer />
    </div>
  );
}
