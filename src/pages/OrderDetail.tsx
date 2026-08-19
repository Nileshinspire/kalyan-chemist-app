import { useNavigate } from "react-router";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowLeft, Package } from "lucide-react";

export default function OrderDetail() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
          <Button variant="ghost" size="sm" className="mb-6 gap-1.5 text-sm text-muted-foreground" onClick={() => navigate("/orders")}>
            <ArrowLeft className="size-4" /> All Orders
          </Button>

          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Package className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Order Details Coming Soon</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Full order details and tracking will be available in Phase 2.
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
