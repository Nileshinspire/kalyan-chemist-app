import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Sparkles, ArrowUpRight, Building2 } from "lucide-react";

export default function Brands() {
  const navigate = useNavigate();
  const brands = useQuery(api.publicBrands.list);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-primary/[0.03] to-transparent border-b border-border/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3" />
                All Brands
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Browse Brands</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Explore products from trusted pharmaceutical brands.</p>
            </motion.div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(brands ?? []).map((brand, i) => (
              <motion.div
                key={brand._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 cursor-pointer hover:-translate-y-1"
                onClick={() => navigate(`/products?brand=${brand.slug}`)}
              >
                <div className="relative flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-white group-hover:scale-110">
                    <Building2 className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{brand.name}</h3>
                      <Badge variant="secondary" className="text-[10px]">{brand.productCount} products</Badge>
                    </div>
                    {brand.country && (
                      <p className="mt-1 text-xs text-muted-foreground">{brand.country}</p>
                    )}
                    {brand.description && (
                      <p className="mt-1.5 text-sm text-muted-foreground">{brand.description}</p>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <ArrowUpRight className="size-4 text-primary/60" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
