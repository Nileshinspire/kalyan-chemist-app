import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Loader2, PackageOpen, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

/* ─── Hot Sellers — View All ───
 * Dedicated listing of the products ranked highest by real completed sales,
 * driven by the same `api.publicProducts.hotSellers` query that powers the
 * homepage section. Uses the existing product-card infrastructure — no
 * duplicate product or ranking system.
 */
export default function HotSellers() {
  const navigate = useNavigate();
  const products = useQuery(api.publicProducts.hotSellers, {});

  const isLoading = products === undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="border-b border-border/30 bg-gradient-to-b from-primary/[0.03] to-transparent">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <TrendingUp className="size-3" aria-hidden="true" />
                Bestselling
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Hot Sellers
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {products
                  ? `Our ${products.length} most-purchased item${products.length === 1 ? "" : "s"}, ranked by real sales`
                  : "Our most-purchased medicines, ranked by real sales"}
              </p>
            </motion.div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <PackageOpen className="size-7 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                No bestselling products yet
              </h2>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Hot Sellers is built from real completed orders, so this list
                fills up as customers order.
              </p>
              <Button
                variant="outline"
                className="mt-4 rounded-xl text-sm"
                onClick={() => navigate("/products")}
              >
                Browse All Products
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
