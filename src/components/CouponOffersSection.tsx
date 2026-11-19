import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { preloadRoute } from "@/lib/route-preload";
import { Button } from "@/components/ui/button";
import { ArrowRight, Ticket } from "lucide-react";
import { useNavigate } from "react-router";
import CouponOfferCard from "@/components/CouponOfferCard";

/**
 * Homepage "Offers & Coupons" section. Renders nothing when the admin has not
 * enabled any active coupon for the homepage, so the existing homepage layout
 * is never disturbed.
 */
export default function CouponOffersSection() {
  const navigate = useNavigate();
  const data = useQuery(api.coupons.publicOffers, { placement: "homepage", limit: 4 });

  const offers = data?.offers ?? [];
  if (offers.length === 0) return null;

  const openOffers = () => {
    preloadRoute("/offers");
    navigate("/offers");
  };

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5 sm:mb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <Ticket className="size-3" />
            Offers &amp; Coupons
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Save More on Every Order
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Apply a code at checkout and pay less on your medicines.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
          onClick={openOffers}
        >
          View All
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {offers.map((offer) => (
          <CouponOfferCard key={offer.couponId} offer={offer} compact />
        ))}
      </div>
    </section>
  );
}
