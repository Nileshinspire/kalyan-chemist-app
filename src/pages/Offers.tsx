import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CouponOfferCard from "@/components/CouponOfferCard";
import { Loader2, Ticket } from "lucide-react";
import { motion } from "framer-motion";

/** Dedicated customer Offers & Coupons page (linked from the homepage). */
export default function Offers() {
  const data = useQuery(api.coupons.publicOffers, { placement: "all", limit: 100 });
  const categories = useQuery(api.categories.list);

  const categoryNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories ?? []) map.set(category._id, category.name);
    return map;
  }, [categories]);

  const offers = data?.offers ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8 sm:py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
              <Ticket className="size-3" />
              Offers &amp; Coupons
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              All Available Offers
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Copy a code and apply it in your cart or at checkout.
            </p>
          </div>

          {data === undefined ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : offers.length === 0 ? (
            <div className="text-center py-24">
              <Ticket className="size-12 text-muted-foreground/25 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground">No offers right now</h2>
              <p className="text-sm text-muted-foreground mt-1">
                New coupon offers will appear here as soon as they are live.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => (
                <CouponOfferCard
                  key={offer.couponId}
                  offer={offer}
                  categoryNames={offer.eligibleCategoryIds
                    .map((id) => categoryNamesById.get(id))
                    .filter(Boolean) as string[]}
                />
              ))}
            </div>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
