import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowUpRight,
  Pill,
  HeartPulse,
  Stethoscope,
  Baby,
  Leaf,
  Shield,
  Brain,
  Tag,
} from "lucide-react";

const CATEGORY_STYLES: Record<string, { icon: typeof Pill; color: string; hoverBg: string }> = {
  "pain-relief": { icon: Pill, color: "from-orange-500/15 to-red-500/15", hoverBg: "hover:from-orange-500/20 hover:to-red-500/20" },
  "heart-cardio": { icon: HeartPulse, color: "from-rose-500/15 to-pink-500/15", hoverBg: "hover:from-rose-500/20 hover:to-pink-500/20" },
  "diabetes-care": { icon: Stethoscope, color: "from-blue-500/15 to-cyan-500/15", hoverBg: "hover:from-blue-500/20 hover:to-cyan-500/20" },
  "baby-mother": { icon: Baby, color: "from-violet-500/15 to-purple-500/15", hoverBg: "hover:from-violet-500/20 hover:to-purple-500/20" },
  "vitamins-supplements": { icon: Leaf, color: "from-emerald-500/15 to-green-500/15", hoverBg: "hover:from-emerald-500/20 hover:to-green-500/20" },
  "skin-personal-care": { icon: Sparkles, color: "from-pink-500/15 to-fuchsia-500/15", hoverBg: "hover:from-pink-500/20 hover:to-fuchsia-500/20" },
  "antibiotics": { icon: Shield, color: "from-teal-500/15 to-cyan-500/15", hoverBg: "hover:from-teal-500/20 hover:to-cyan-500/20" },
  "digestive-health": { icon: Stethoscope, color: "from-amber-500/15 to-yellow-500/15", hoverBg: "hover:from-amber-500/20 hover:to-yellow-500/20" },
};
const DEFAULT_STYLE = { icon: Tag, color: "from-primary/15 to-primary/10", hoverBg: "hover:from-primary/20 hover:to-primary/15" };

export default function Categories() {
  const navigate = useNavigate();
  const categories = useQuery(api.categories.list);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="bg-gradient-to-b from-primary/[0.03] to-transparent border-b border-border/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3" />
                All Categories
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Browse Categories</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Find medicines and healthcare products organised by category.</p>
            </motion.div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(categories ?? []).map((cat, i) => {
              const style = CATEGORY_STYLES[cat.slug] ?? DEFAULT_STYLE;
              const Icon = style.icon;
              return (
                <motion.div
                  key={cat._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 cursor-pointer hover:-translate-y-1`}
                  onClick={() => navigate(`/products?category=${cat.slug}`)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${style.color} ${style.hoverBg} opacity-0 group-hover:opacity-100 transition-all duration-500`} />
                  <div className="relative flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-white group-hover:scale-110">
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{cat.name}</h3>
                        <Badge variant="secondary" className="text-[10px]">{cat.productCount} products</Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{cat.description}</p>
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                    <ArrowUpRight className="size-4 text-primary/60" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
