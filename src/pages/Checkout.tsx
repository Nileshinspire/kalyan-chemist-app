import { useNavigate } from "react-router";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard } from "lucide-react";

export default function Checkout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
          <Button variant="ghost" size="sm" className="mb-6 gap-1.5 text-sm text-muted-foreground rounded-xl" onClick={() => navigate("/cart")}>
            <ArrowLeft className="size-4" /> Back to Cart
          </Button>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-8">Checkout</h1>
          </motion.div>

          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <CreditCard className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Checkout Coming Soon</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Full checkout with address management, payment options, and order placement will be available in Phase 2.
              </p>
              <Button className="mt-5 font-semibold gradient-primary text-white rounded-xl" onClick={() => navigate("/products")}>
                Browse Medicines
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
