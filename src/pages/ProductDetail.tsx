import { useParams, useNavigate } from "react-router";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Pill } from "lucide-react";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors rounded-xl"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Pill className="size-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Product Details Coming Soon
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Detailed product pages will be available in Phase 2 when we launch
            our full medicine catalogue.
          </p>
          <Button
            className="mt-6 font-semibold gradient-primary text-white rounded-xl"
            onClick={() => navigate("/products")}
          >
            Browse Medicines
          </Button>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
