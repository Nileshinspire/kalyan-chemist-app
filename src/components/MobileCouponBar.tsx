import { useAuth } from "@/context/AuthContext";
import type { CouponOffer } from "@/components/CouponOfferCard";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/auth-utils";
import { BadgePercent } from "lucide-react";
import { useNavigate } from "react-router";

/**
 * Mobile-only fixed coupon bar on the homepage, sitting directly above the
 * existing bottom navigation. The coupon comes from the existing coupon
 * system (active + homepage visibility) and the whole bar disappears when no
 * coupon is eligible — no fallback or placeholder offer is ever shown.
 *
 * Desktop/tablet (`md` and up) renders nothing; the existing Offers & Coupons
 * section remains the desktop presentation.
 */
export default function MobileCouponBar({
  offer,
}: {
  offer: CouponOffer | null;
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (!offer) return null;

  const discountText =
    offer.discountType === "free_delivery"
      ? "FREE DELIVERY*"
      : offer.discountType === "fixed"
        ? `FLAT ${formatCurrency(offer.fixedDiscount)} OFF*`
        : `FLAT ${offer.discountPercent}% OFF*`;

  return (
    <>
      {/* Reserves the bar's height so it never covers the end of the page. */}
      <div aria-hidden="true" className="h-[52px] md:hidden" />

      <div
        className="fixed inset-x-0 z-30 border-t border-primary/10 bg-[#e9f8f5] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:hidden"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      >
        {/* Right inset clears the existing floating WhatsApp button, which
            occupies this same band; the Login action stays fully tappable. */}
        <div className="mx-auto flex max-w-md items-center gap-2.5 pl-3 pr-[4.25rem] py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
            <BadgePercent className="size-4" />
          </span>

          <p className="min-w-0 flex-1 truncate text-[12px] font-bold leading-tight text-foreground">
            {discountText}
            <span className="mx-1 font-normal text-muted-foreground">|</span>
            <span className="font-semibold">Code:</span>{" "}
            <span className="font-mono text-primary">{offer.code}</span>
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(isAuthenticated ? "/cart" : "/auth?returnTo=/")
            }
            className="h-9 shrink-0 rounded-lg border-primary/50 bg-white px-4 text-xs font-semibold text-primary hover:bg-primary/5"
          >
            {isAuthenticated ? "Use Code" : "Login"}
          </Button>
        </div>
      </div>
    </>
  );
}
