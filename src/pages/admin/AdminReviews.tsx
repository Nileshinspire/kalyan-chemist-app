import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Package,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminReviews() {
  const [search, setSearch] = useState("");
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);

  const reviews = useQuery(api.admin.listReviews);
  const deleteReview = useMutation(api.admin.deleteReview);

  const filteredReviews = reviews?.filter((r: any) => {
    if (!search) return true;
    return (
      r.productName?.toLowerCase().includes(search.toLowerCase()) ||
      r.userName?.toLowerCase().includes(search.toLowerCase()) ||
      r.title?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleDelete = async () => {
    if (!deleteDialogId) return;
    try {
      await deleteReview({ reviewId: deleteDialogId as any });
      toast.success("Review deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete review");
    }
    setDeleteDialogId(null);
  };

  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews?.filter((r: any) => Math.round(r.rating) === stars).length || 0,
  }));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reviews</h1>
          <p className="text-sm text-muted-foreground">View and moderate customer reviews</p>
        </motion.div>

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
                {ratingDistribution.map((r) => {
                  const pct = reviews.length > 0 ? (r.count / reviews.length) * 100 : 0;
                  return (
                    <div key={r.stars} className="flex items-center gap-2">
                      <span className="text-xs font-medium w-6">{r.stars}★</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{r.count}</span>
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
            placeholder="Search reviews..."
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
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialogId} onOpenChange={() => setDeleteDialogId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Review?</DialogTitle>
            <DialogDescription>This will permanently remove this review.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
