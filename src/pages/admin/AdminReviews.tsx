import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Star,
  Loader2,
  Search,
  Trash2,
  User,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  StarOff,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "product_reviews" | "testimonials";

// Safe date formatter — never crashes on invalid/missing timestamps
function formatDate(timestamp: number | undefined | null): string {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// Safe star renderer — handles any rating value
function StarRating({ rating, size = "size-3.5" }: { rating: number; size?: string }) {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating || 0)));
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${size} ${
            i < safeRating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

export default function AdminReviews() {
  const [tab, setTab] = useState<Tab>("testimonials");
  const [search, setSearch] = useState("");

  // ── Separate dialog states for each tab ──
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);
  const [deleteTestimonialId, setDeleteTestimonialId] = useState<string | null>(null);
  const [rejectTestimonialId, setRejectTestimonialId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [viewTestimonialId, setViewTestimonialId] = useState<string | null>(null);

  const [reviewFilter, setReviewFilter] = useState<string>("all");

  // ── Product reviews (existing) ──
  const reviews = useQuery(api.admin.listReviews);
  const deleteReview = useMutation(api.admin.deleteReview);

  // ── Testimonials ──
  const testimonials = useQuery(api.testimonials.adminList, {});
  const approveTestimonial = useMutation(api.testimonials.adminApprove);
  const rejectTestimonial = useMutation(api.testimonials.adminReject);
  const toggleFeatured = useMutation(api.testimonials.adminToggleFeatured);
  const deleteTestimonial = useMutation(api.testimonials.adminDelete);

  // ── Product Reviews filtering ──
  const filteredReviews = reviews?.filter((r: any) => {
    if (!search) return true;
    return (
      r.productName?.toLowerCase().includes(search.toLowerCase()) ||
      r.userName?.toLowerCase().includes(search.toLowerCase()) ||
      r.title?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleDeleteProductReview = async () => {
    if (!deleteReviewId) return;
    try {
      await deleteReview({ reviewId: deleteReviewId as any });
      toast.success("Review deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete review");
    }
    setDeleteReviewId(null);
  };

  // ── Testimonials filtering ──
  const filteredTestimonials = testimonials?.filter((t: any) => {
    if (reviewFilter !== "all" && t.status !== reviewFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (t.displayName || "").toLowerCase().includes(s) ||
      (t.customerName || "").toLowerCase().includes(s) ||
      (t.title || "").toLowerCase().includes(s) ||
      (t.message || "").toLowerCase().includes(s)
    );
  });

  // ── Find the full testimonial object by ID (safe lookup) ──
  const viewTestimonial = viewTestimonialId
    ? testimonials?.find((t: any) => t._id === viewTestimonialId) || null
    : null;

  const handleApproveTestimonial = async (id: string) => {
    try {
      await approveTestimonial({ testimonialId: id as any });
      toast.success("Testimonial approved");
      setViewTestimonialId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    }
  };

  const handleRejectTestimonial = async () => {
    if (!rejectTestimonialId) return;
    try {
      await rejectTestimonial({
        testimonialId: rejectTestimonialId as any,
        adminNotes: rejectNotes.trim() || undefined,
      });
      toast.success("Testimonial rejected");
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    }
    setRejectTestimonialId(null);
    setRejectNotes("");
    setViewTestimonialId(null);
  };

  const handleToggleFeatured = async (id: string, featured: boolean) => {
    try {
      await toggleFeatured({ testimonialId: id as any, featured });
      toast.success(featured ? "Marked as featured" : "Removed from featured");
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const handleDeleteTestimonial = async () => {
    if (!deleteTestimonialId) return;
    try {
      await deleteTestimonial({ testimonialId: deleteTestimonialId as any });
      toast.success("Testimonial deleted");
      setViewTestimonialId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
    setDeleteTestimonialId(null);
  };

  // ── Stats ──
  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : "0.0";

  const totalTestimonials = testimonials?.length || 0;
  const pendingTestimonials = testimonials?.filter((t: any) => t.status === "pending").length || 0;
  const approvedTestimonials = testimonials?.filter((t: any) => t.status === "approved").length || 0;
  const featuredTestimonials = testimonials?.filter((t: any) => t.featured).length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reviews & Testimonials</h1>
          <p className="text-sm text-muted-foreground">Manage customer reviews and store testimonials</p>
        </motion.div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1 bg-muted/30 rounded-xl w-fit">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "testimonials"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setTab("testimonials"); setSearch(""); }}
          >
            <MessageSquare className="size-3.5 inline mr-1.5" />
            Store Testimonials
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "product_reviews"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setTab("product_reviews"); setSearch(""); }}
          >
            <Star className="size-3.5 inline mr-1.5" />
            Product Reviews
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/* TESTIMONIALS TAB                                           */}
        {/* ════════════════════════════════════════════════════════════ */}
        {tab === "testimonials" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                <p className="text-lg font-bold text-foreground">{totalTestimonials}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-lg font-bold text-amber-700">{pendingTestimonials}</p>
                <p className="text-xs text-amber-600">Pending</p>
              </div>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                <p className="text-lg font-bold text-green-700">{approvedTestimonials}</p>
                <p className="text-xs text-green-600">Approved</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-lg font-bold text-primary">{featuredTestimonials}</p>
                <p className="text-xs text-primary">Featured</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search testimonials..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1.5">
                {["all", "pending", "approved", "rejected"].map((f) => (
                  <Button
                    key={f}
                    variant={reviewFilter === f ? "default" : "outline"}
                    size="sm"
                    className="text-xs capitalize"
                    onClick={() => setReviewFilter(f)}
                  >
                    {f}
                  </Button>
                ))}
              </div>
            </div>

            {/* Testimonials List */}
            {testimonials === undefined ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredTestimonials || filteredTestimonials.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-16 text-center">
                  <MessageSquare className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">No testimonials found</h3>
                  <p className="text-sm text-muted-foreground">
                    {search || reviewFilter !== "all" ? "Try different filters" : "Customer testimonials will appear here"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTestimonials.map((t: any) => (
                  <Card
                    key={t._id}
                    className="border-border/60 hover:shadow-sm transition-all cursor-pointer hover:border-primary/30"
                    onClick={() => setViewTestimonialId(t._id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="size-4 text-primary/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-semibold">{t.customerName || t.displayName || "Anonymous"}</p>
                            <Badge className={`text-[10px] ${STATUS_BADGES[t.status]?.className || ""}`}>
                              {STATUS_BADGES[t.status]?.label || t.status}
                            </Badge>
                            {t.featured && (
                              <Badge className="text-[10px] bg-primary/10 text-primary">
                                <Star className="size-2.5 mr-0.5 fill-primary" />
                                Featured
                              </Badge>
                            )}
                          </div>
                          <StarRating rating={t.rating} />
                          {t.title && (
                            <p className="text-sm font-medium mt-1 mb-0.5">{t.title}</p>
                          )}
                          {t.message && (
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                              {t.message}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            {formatDate(t.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] gap-1 text-primary hover:bg-primary/5"
                            onClick={(e) => { e.stopPropagation(); setViewTestimonialId(t._id); }}
                          >
                            <Eye className="size-3" /> View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* PRODUCT REVIEWS TAB (existing functionality)                */}
        {/* ════════════════════════════════════════════════════════════ */}
        {tab === "product_reviews" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                <p className="text-lg font-bold text-foreground">{reviews?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Reviews</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div className="flex items-center gap-1">
                  <p className="text-lg font-bold text-foreground">{avgRating}</p>
                  <Star className="size-4 text-amber-400 fill-amber-400" />
                </div>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                <p className="text-lg font-bold text-foreground">
                  {reviews?.filter((r: any) => (r.rating || 0) >= 4).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Positive (4★+)</p>
              </div>
            </div>

            {reviews && reviews.length > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Rating Distribution</p>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = reviews.filter((r: any) => Math.round(r.rating || 0) === stars).length;
                      const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="text-xs font-medium w-6">{stars}★</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search product reviews..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {reviews === undefined ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredReviews || filteredReviews.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-16 text-center">
                  <Star className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">No reviews found</h3>
                  <p className="text-sm text-muted-foreground">
                    {search ? "Try a different search" : "Customer reviews will appear here"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredReviews.map((review: any) => (
                  <Card key={review._id} className="border-border/60 hover:shadow-sm transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="size-4 text-primary/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-semibold">{review.userName || "Anonymous"}</p>
                            <span className="text-xs text-muted-foreground">reviewed</span>
                            <p className="text-sm font-medium text-primary">{review.productName || "Product"}</p>
                          </div>
                          <StarRating rating={review.rating} />
                          {review.title && (
                            <p className="text-sm font-medium mt-1 mb-0.5">{review.title}</p>
                          )}
                          {review.body && (
                            <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            {formatDate(review.createdAt)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] text-destructive hover:text-destructive hover:bg-destructive/5 gap-1 shrink-0"
                          onClick={() => setDeleteReviewId(review._id)}
                        >
                          <Trash2 className="size-3" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VIEW / OPEN TESTIMONIAL DETAIL DIALOG                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={!!viewTestimonialId} onOpenChange={() => setViewTestimonialId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {viewTestimonial ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Eye className="size-5 text-primary" />
                  Testimonial Details
                </DialogTitle>
                <DialogDescription>
                  Submitted {formatDate(viewTestimonial.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Customer Info */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="size-5 text-primary/60" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{viewTestimonial.customerName || viewTestimonial.displayName || "Anonymous"}</p>
                    {viewTestimonial.displayName !== viewTestimonial.customerName && viewTestimonial.displayName && (
                      <p className="text-xs text-muted-foreground">Display name: {viewTestimonial.displayName}</p>
                    )}
                  </div>
                </div>

                {/* Status + Featured */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs ${STATUS_BADGES[viewTestimonial.status]?.className || ""}`}>
                    {STATUS_BADGES[viewTestimonial.status]?.label || viewTestimonial.status}
                  </Badge>
                  {viewTestimonial.featured && (
                    <Badge className="text-xs bg-primary/10 text-primary">
                      <Star className="size-3 mr-0.5 fill-primary" />
                      Featured
                    </Badge>
                  )}
                </div>

                {/* Star Rating */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Rating</p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={viewTestimonial.rating} size="size-5" />
                    <span className="text-sm font-semibold text-foreground">{viewTestimonial.rating}/5</span>
                  </div>
                </div>

                {/* Title */}
                {viewTestimonial.title && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Title</p>
                    <p className="text-sm font-semibold text-foreground">{viewTestimonial.title}</p>
                  </div>
                )}

                {/* Message */}
                {viewTestimonial.message && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Review</p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {viewTestimonial.message}
                    </p>
                  </div>
                )}

                {/* Admin Notes */}
                {viewTestimonial.adminNotes && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Admin Notes</p>
                    <p className="text-sm text-muted-foreground italic">{viewTestimonial.adminNotes}</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium">Submitted</p>
                    <p>{formatDate(viewTestimonial.createdAt)}</p>
                  </div>
                  <div>
                    <p className="font-medium">Last Updated</p>
                    <p>{formatDate(viewTestimonial.updatedAt)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
                <Button variant="outline" size="sm" onClick={() => setViewTestimonialId(null)}>
                  Close
                </Button>
                {viewTestimonial.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white gap-1"
                      onClick={() => handleApproveTestimonial(viewTestimonial._id)}
                    >
                      <CheckCircle className="size-3" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => {
                        setRejectTestimonialId(viewTestimonial._id);
                        setRejectNotes("");
                      }}
                    >
                      <XCircle className="size-3" /> Reject
                    </Button>
                  </>
                )}
                {viewTestimonial.status === "approved" && (
                  <Button
                    size="sm"
                    variant={viewTestimonial.featured ? "outline" : "default"}
                    className={`gap-1 ${viewTestimonial.featured ? "text-amber-600" : ""}`}
                    onClick={() => handleToggleFeatured(viewTestimonial._id, !viewTestimonial.featured)}
                  >
                    {viewTestimonial.featured ? (
                      <><StarOff className="size-3" /> Remove Featured</>
                    ) : (
                      <><Star className="size-3" /> Mark as Featured</>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/5 gap-1"
                  onClick={() => {
                    setDeleteTestimonialId(viewTestimonial._id);
                  }}
                >
                  <Trash2 className="size-3" /> Delete
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-12 text-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground mx-auto" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DELETE PRODUCT REVIEW DIALOG                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={!!deleteReviewId} onOpenChange={() => setDeleteReviewId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Review?</DialogTitle>
            <DialogDescription>This will permanently remove this product review.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReviewId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProductReview}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DELETE TESTIMONIAL DIALOG                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={!!deleteTestimonialId} onOpenChange={() => setDeleteTestimonialId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Testimonial?</DialogTitle>
            <DialogDescription>This will permanently remove this testimonial. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTestimonialId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTestimonial}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* REJECT TESTIMONIAL DIALOG                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Dialog open={!!rejectTestimonialId} onOpenChange={() => { setRejectTestimonialId(null); setRejectNotes(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Testimonial?</DialogTitle>
            <DialogDescription>Optionally provide a reason for rejection. The customer will not be notified.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTestimonialId(null); setRejectNotes(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectTestimonial}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
