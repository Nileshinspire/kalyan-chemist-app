import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Star, Loader2, PenLine, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface WriteReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WriteReview({ open, onOpenChange }: WriteReviewProps) {
  const [displayName, setDisplayName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitTestimonial = useMutation(api.testimonials.submit);
  const myTestimonial = useQuery(api.testimonials.getMyTestimonial);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }
    if (!displayName.trim()) {
      toast.error("Please enter your display name");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a review title");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter your review message");
      return;
    }

    setSubmitting(true);
    try {
      await submitTestimonial({
        displayName: displayName.trim(),
        rating,
        title: title.trim(),
        message: message.trim(),
      });
      toast.success("Review submitted! It will appear after admin approval.");
      setDisplayName("");
      setRating(0);
      setTitle("");
      setMessage("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const hasActive = myTestimonial && (myTestimonial.status === "pending" || myTestimonial.status === "approved");

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending Review", color: "bg-amber-100 text-amber-700" },
    approved: { label: "Approved", color: "bg-green-100 text-green-700" },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PenLine className="size-5 text-primary" />
            Write a Review
          </DialogTitle>
          <DialogDescription>
            Share your experience with Kalyan Chemist. Your review will appear publicly after admin approval.
          </DialogDescription>
        </DialogHeader>

        {hasActive ? (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/60">
              <div className="flex-shrink-0">
                {(() => {
                  const cfg = STATUS_CONFIG[myTestimonial!.status] ?? STATUS_CONFIG.pending;
                  return <Badge className={`${cfg.color} text-xs`}>{cfg.label}</Badge>;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{myTestimonial!.title}</p>
                <div className="flex items-center gap-0.5 mt-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`size-3 ${i < myTestimonial!.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              You {myTestimonial!.status === "approved" ? "already have an approved review" : "have a review pending approval"}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Star Rating */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Your Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className="focus:outline-none transition-transform hover:scale-110"
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(star)}
                  >
                    <Star
                      className={`size-7 transition-colors ${
                        star <= (hoveredStar || rating)
                          ? "text-amber-400 fill-amber-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {rating === 1 && "Poor"}
                    {rating === 2 && "Fair"}
                    {rating === 3 && "Good"}
                    {rating === 4 && "Very Good"}
                    {rating === 5 && "Excellent"}
                  </span>
                )}
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Your Name</label>
              <Input
                placeholder="e.g. Priya S."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                required
              />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Review Title</label>
              <Input
                placeholder="e.g. Great service and fast delivery"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Your Review</label>
              <Textarea
                placeholder="Tell us about your experience with Kalyan Chemist..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={4}
                required
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length}/2000
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full gradient-primary text-white font-semibold rounded-xl h-11"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <PenLine className="size-4 mr-2" />
              )}
              Submit Review
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
