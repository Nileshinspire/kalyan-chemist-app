import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import CouponOfferCard from "@/components/CouponOfferCard";
import { Button } from "@/components/ui/button";
import { Loader2, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";

type Tab = "available" | "used" | "expired";

const TABS: { key: Tab; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "used", label: "Used" },
  { key: "expired", label: "Expired" },
];

/**
 * My Coupons — only backend-eligible coupons the admin chose to show in this
 * section. First-order-only coupons disappear from Available once the customer
 * has placed an order, and per-customer limits are enforced server-side.
 */
export default function AccountMyCoupons() {
  const data = useQuery(api.coupons.myCoupons);
  const categories = useQuery(api.categories.list);
  const [tab, setTab] = useState<Tab>("available");
  const navigate = useNavigate();

  const namesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories ?? []) map.set(category._id, category.name);
    return map;
  }, [categories]);

  const groups = {
    available: data?.available ?? [],
    used: data?.used ?? [],
    expired: data?.expired ?? [],
  };
  const current = groups[tab];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Ticket className="size-5 text-primary" /> My Coupons
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Coupons you can use, and the ones you have already used.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              tab === item.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/40"
            }`}
          >
            {item.label}
            <span className="ml-1.5 text-[10px] opacity-70">{groups[item.key].length}</span>
          </button>
        ))}
      </div>

      {data === undefined ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : current.length === 0 ? (
        <div className="rounded-xl border border-border/60 py-14 text-center">
          <Ticket className="size-10 text-muted-foreground/25 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">
            {tab === "available"
              ? "No coupons available right now"
              : tab === "used"
                ? "You haven't used any coupons yet"
                : "No expired coupons"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {tab === "available"
              ? "New offers will appear here when they go live."
              : "Coupons you redeem and let expire are kept here for reference."}
          </p>
          {tab === "available" && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/offers")}>
              Browse all offers
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {current.map((offer: any) => (
            <CouponOfferCard
              key={offer.couponId}
              offer={offer}
              compact
              statusLabel={tab === "used" ? "Used" : tab === "expired" ? "Expired" : undefined}
              hideValidity={tab !== "available"}
              categoryNames={offer.eligibleCategoryIds
                .map((id: string) => namesById.get(id))
                .filter(Boolean) as string[]}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
