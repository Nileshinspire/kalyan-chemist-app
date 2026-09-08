import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { BadgePercent, Loader2, PackageOpen } from "lucide-react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

/* ─── Value Deals Under ₹100 — View All ───
 * Dedicated listing of EVERY currently eligible non-medicine product priced
 * at ₹100 or less (same rules as the homepage section, driven by the same
 * `api.publicProducts.valueDeals` query with no limit). Uses the existing
 * product-card infrastructure — no duplicate product system.
 */
export default function ValueDealsPage() {
  const navigate = useNavigate();
  const deals = useQuery(api.publicProducts.valueDeals, {});

  const isLoading = deals === undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="bg-gradient-to-b from-primary/[0.03] to-transparent border-b border-border/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <BadgePercent className="size-3" />
                Pocket-Friendly
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Value Deals Under ₹100
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {deals
                  ? `${deals.length} everyday essential${deals.length === 1 ? "" : "s"} at pocket-friendly prices`
                  : "Everyday essentials at pocket-friendly prices"}
              </p>
            </motion.div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !deals || deals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <PackageOpen className="size-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                No value deals available right now
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm leading-relaxed">
                New everyday essentials under ₹100 are added regularly. Check
                back soon.
              </p>
              <Button
                variant="outline"
                className="mt-4 text-sm rounded-xl"
                onClick={() => navigate("/products")}
              >
                Browse All Products
              </Button>
            </motion.div>
          ) : (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {deals.map((product) => (
                <ProductCard key={product._id} product={product as any} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}