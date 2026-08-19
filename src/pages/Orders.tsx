import { useNavigate } from "react-router";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowLeft, ClipboardList, Package } from "lucide-react";

export default function Orders() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="ghost" size="sm" className="mb-4 gap-1.5 text-muted-foreground rounded-xl" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
              <ClipboardList className="size-3" /> Order History
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-8">My Orders</h1>
          </motion.div>

          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Package className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No orders yet</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Your order history will appear here once you place your first order.
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
