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
  ThumbsUp,
  StarOff,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "product_reviews" | "testimonials";

export default function AdminReviews() {
  const [tab, setTab] = useState<Tab>("testimonials");
  const [search, setSearch] = useState("");
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [reviewFilter, setReviewFilter] = useState<string>("all");

  // Product reviews (existing)
  const reviews = useQuery(api.admin.listReviews);
  const deleteReview = useMutation(api.admin.deleteReview);

  // Testimonials
  const testimonials = useQuery(api.testimonials.adminList, {});
  const approveTestimonial = useMutation(api.testimonials.adminApprove);
  const rejectTestimonial = useMutation(api.testimonials.adminReject);
  const toggleFeatured = useMutation(api.testimonials.adminToggleFeatured);
  const deleteTestimonial = useMutation(api.testimonials.adminDelete);

  // ── Product Reviews (existing) ──
  const filteredReviews = reviews?.filter((r: any) => {
    if (!search) return true;
    return (
      r.productName?.toLowerCase().includes(search.toLowerCase()) ||
      r.userName?.toLowerCase().includes(search.toLowerCase()) ||
      r.title?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleDeleteProductReview = async () => {
    if (!deleteDialogId) return;
    try {
      await deleteReview({ reviewId: deleteDialogId as any });
      toast.success("Review deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete review");
    }
    setDeleteDialogId(null);
  };

  // ── Testimonials ──
  const filteredTestimonials = testimonials?.filter((t: any) => {
    if (reviewFilter !== "all" && t.status !== reviewFilter) return false;
    if (!search) return true;
    return (
      t.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      t.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.message?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleApproveTestimonial = async (id: string) => {
    try {
      await approveTestimonial({ testimonialId: id as any });
      toast.success("Testimonial approved");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    }
  };

  const handleRejectTestimonial = async () => {
    if (!rejectDialogId) return;
    try {
      await rejectTestimonial({
        testimonialId: rejectDialogId as any,
        adminNotes: rejectNotes.trim() || undefined,
      });
      toast.success("Testimonial rejected");
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    }
    setRejectDialogId(null);
    setRejectNotes("");
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
    if (!deleteDialogId) return;
    try {
      await deleteTestimonial({ testimonialId: deleteDialogId as any });
      toast.success("Testimonial deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
    setDeleteDialogId(null);
  };

  // Stats
  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const totalTestimonials = testimonials?.length || 0;
  const pendingTestimonials = testimonials?.filter((t: any) => t.status === "pending").length || 0;
  const approvedTestimonials = testimonials?.filter((t: any) => t.status === "approved").length || 0;
  const featuredTestimonials = testimonials?.filter((t: any) => t.featured).length || 0;

  const STATUS_BADGES: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
    approved: { label: "Approved", className: "bg-green-100 text-green-700" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  };

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

        {/* ── TESTIMONIALS TAB ── */}
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
                  <Card key={t._id} className="border-border/60 hover:shadow-sm transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="size-4 text-primary/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-semibold">{t.customerName || t.displayName}</p>
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
                          <div className="flex items-center gap-1 mb-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                className={`size-3.5 ${
                                  i < t.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">{t.rating}/5</span>
                          </div>
                          {t.title && (
                            <p className="text-sm font-medium mb-0.5">{t.title}</p>
                          )}
                          {t.message && (
                            <p className="text-sm text-muted-foreground leading-relaxed">{t.message}</p>
                          )}
                          {t.adminNotes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">Admin note: {t.adminNotes}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            {new Date(t.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          {t.status === "pending" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
                                onClick={() => handleApproveTestimonial(t._id)}
                              >
                                <CheckCircle className="size-3" /> Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                                onClick={() => setRejectDialogId(t._id)}
                              >
                                <XCircle className="size-3" /> Reject
                              </Button>
                            </>
                          )}
                          {t.status === "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className={`text-[10px] gap-1 ${t.featured ? "text-amber-600 hover:bg-amber-50" : "text-primary hover:bg-primary/5"}`}
                              onClick={() => handleToggleFeatured(t._id, !t.featured)}
                            >
                              {t.featured ? (
                                <><StarOff className="size-3" /> Unfeature</>
                              ) : (
                                <><Star className="size-3" /> Feature</>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] text-destructive hover:text-destructive hover:bg-destructive/5 gap-1"
                            onClick={() => setDeleteDialogId(t._id)}
                          >
                            <Trash2 className="size-3" /> Delete
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

        {/* ── PRODUCT REVIEWS TAB (existing functionality) ── */}
        {tab === "product_reviews" && (
          <>
            {/* Stats */}
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
                  {reviews?.filter((r: any) => r.rating >= 4).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Positive (4★+)</p>
              </div>
            </div>

            {/* Rating Distribution */}
            {reviews && reviews.length > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Rating Distribution</p>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = reviews.filter((r: any) => Math.round(r.rating) === stars).length;
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

            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search product reviews..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Reviews List */}
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
                            <p className="text-sm font-semibold">{review.userName}</p>
                            <span className="text-xs text-muted-foreground">reviewed</span>
                            <p className="text-sm font-medium text-primary">{review.productName}</p>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                className={`size-3.5 ${
                                  i < review.rating
                                    ? "text-amber-400 fill-amber-400"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">{review.rating}/5</span>
                          </div>
                          {review.title && (
                            <p className="text-sm font-medium mb-0.5">{review.title}</p>
                          )}
                          {review.body && (
                            <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            {new Date(review.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] text-destructive hover:text-destructive hover:bg-destructive/5 gap-1 shrink-0"
                          onClick={() => setDeleteDialogId(review._id)}
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

      {/* Delete Product Review Dialog */}
      <Dialog open={!!deleteDialogId && tab === "product_reviews"} onOpenChange={() => setDeleteDialogId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Review?</DialogTitle>
            <DialogDescription>This will permanently remove this review.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProductReview}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Testimonial Dialog */}
      <Dialog open={!!deleteDialogId && tab === "testimonials"} onOpenChange={() => setDeleteDialogId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Testimonial?</DialogTitle>
            <DialogDescription>This will permanently remove this testimonial.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTestimonial}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Testimonial Dialog */}
      <Dialog open={!!rejectDialogId} onOpenChange={() => { setRejectDialogId(null); setRejectNotes(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Testimonial?</DialogTitle>
            <DialogDescription>Optionally provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogId(null); setRejectNotes(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectTestimonial}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
