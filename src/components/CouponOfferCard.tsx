import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/auth-utils";
import { Check, Copy, Ticket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Customer-safe coupon shape returned by the public coupon queries. */
export interface CouponOffer {
  couponId: string;
  code: string;
  name?: string;
  description?: string;
  discountType: "percentage" | "fixed" | "free_delivery";
  discountPercent: number;
  fixedDiscount: number;
  maxDiscount: number;
  minOrder: number;
  startsAt?: number;
  expiresAt: number;
  firstOrderOnly: boolean;
  perUserLimit?: number;
  eligibleCategoryIds: string[];
  offerText: string;
}

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Short, customer-safe eligibility line shown on every coupon card. */
export function eligibilityText(offer: CouponOffer, categoryNames: string[] = []) {
  const parts: string[] = [];
  if (offer.eligibleCategoryIds.length > 0) {
    parts.push(
      categoryNames.length > 0
        ? `On ${categoryNames.slice(0, 2).join(", ")}${categoryNames.length > 2 ? " & more" : ""}`
        : "Selected categories only",
    );
  } else {
    parts.push("On all products");
  }
  if (offer.minOrder > 0) parts.push(`Min. order ${formatCurrency(offer.minOrder)}`);
  if (offer.firstOrderOnly) parts.push("First order only");
  if (offer.perUserLimit && offer.perUserLimit > 0) {
    parts.push(offer.perUserLimit === 1 ? "Once per customer" : `${offer.perUserLimit} uses per customer`);
  }
  return parts.join(" · ");
}

export function CouponCodeCopy({ code, className = "" }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${code} copied`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the code");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copy}
      aria-label={`Copy coupon code ${code}`}
      className={`h-8 gap-1.5 rounded-lg border-dashed border-primary/40 text-primary hover:bg-primary/5 font-mono text-[11px] ${className}`}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {code}
    </Button>
  );
}

/**
 * Coupon card used by the homepage Offers & Coupons section and the dedicated
 * Offers page. Styling follows the storefront's existing card language.
 */
export default function CouponOfferCard({
  offer,
  categoryNames = [],
  compact = false,
  statusLabel,
  hideValidity = false,
}: {
  offer: CouponOffer;
  categoryNames?: string[];
  compact?: boolean;
  /** Overrides the discount badge, e.g. "Used" / "Expired" in My Coupons. */
  statusLabel?: string;
  hideValidity?: boolean;
}) {
  const headline =
    offer.discountType === "free_delivery"
      ? "Free Delivery"
      : offer.discountType === "fixed"
        ? `Flat ${formatCurrency(offer.fixedDiscount)} OFF`
        : `${offer.discountPercent}% OFF`;

  return (
    <Card className="group border-border/60 hover:border-primary/25 hover:shadow-card-hover transition-all duration-300 h-full">
      <CardContent className={`${compact ? "p-4" : "p-5"} flex h-full flex-col gap-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="size-9 rounded-xl bg-primary/[0.07] flex items-center justify-center shrink-0">
            <Ticket className="size-4 text-primary" />
          </div>
          <Badge
            className={
              statusLabel
                ? "bg-muted text-muted-foreground border-border text-[10px] font-semibold"
                : "bg-primary/10 text-primary border-primary/15 text-[10px] font-semibold"
            }
          >
            {statusLabel ?? headline}
          </Badge>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {offer.name || offer.offerText}
          </p>
          {offer.name && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {offer.description || offer.offerText}
            </p>
          )}
        </div>

        {!compact && (
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p>{eligibilityText(offer, categoryNames)}</p>
            {offer.discountType === "percentage" && offer.maxDiscount > 0 && (
              <p>Maximum discount {formatCurrency(offer.maxDiscount)}</p>
            )}
            {!hideValidity && (
              <p>
                {offer.startsAt && offer.startsAt > Date.now() ? "Starts " : "Valid till "}
                {formatDate(offer.startsAt && offer.startsAt > Date.now() ? offer.startsAt : offer.expiresAt)}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <CouponCodeCopy code={offer.code} />
          {offer.minOrder > 0 && (
            <span className="text-[10px] text-muted-foreground shrink-0">
              Min. {formatCurrency(offer.minOrder)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
