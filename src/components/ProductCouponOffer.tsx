import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/auth-utils";
import { CouponCodeCopy, eligibilityText, type CouponOffer } from "@/components/CouponOfferCard";
import { Tag } from "lucide-react";

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function headline(offer: CouponOffer) {
  if (offer.discountType === "free_delivery") return "Free Delivery";
  if (offer.discountType === "fixed") return `Flat ${formatCurrency(offer.fixedDiscount)} OFF`;
  return `${offer.discountPercent}% OFF`;
}

/**
 * Small coupon hint beside the product price. Only renders when the admin has
 * enabled "Show on eligible product pages" for a live coupon whose category
 * covers this product. The regular pricing UI is not touched.
 */
export default function ProductCouponOffer({ productId }: { productId: Id<"products"> }) {
  const [open, setOpen] = useState(false);
  const data = useQuery(api.coupons.productOffers, { productId, limit: 3 });
  const offers = data?.offers ?? [];

  if (offers.length === 0) return null;
  const first = offers[0];

  return (
    <>
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] px-3 py-2.5 flex items-center gap-2.5 flex-wrap">
        <Tag className="size-4 text-primary shrink-0" />
        <p className="text-xs font-semibold text-foreground min-w-0">
          Extra <span className="text-primary">{headline(first)}</span> with{" "}
          <span className="font-mono">{first.code}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11px] font-semibold text-primary hover:bg-primary/5"
          onClick={() => setOpen(true)}
        >
          View offer details
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4 text-primary" /> Offers on this product
            </DialogTitle>
            <DialogDescription>
              Apply a code in your cart or at checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {offers.map((offer) => (
              <div key={offer.couponId} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {offer.name || offer.offerText}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {eligibilityText(offer)}
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/15 text-[10px] shrink-0">
                    {headline(offer)}
                  </Badge>
                </div>
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  {offer.discountType === "percentage" && offer.maxDiscount > 0 && (
                    <p>Maximum discount {formatCurrency(offer.maxDiscount)}</p>
                  )}
                  <p>Valid till {formatDate(offer.expiresAt)}</p>
                </div>
                <CouponCodeCopy code={offer.code} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
