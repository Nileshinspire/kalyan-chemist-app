import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";

export default function Cart() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="size-20 rounded-2xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] flex items-center justify-center mb-4">
            <ShoppingCart className="size-10 text-primary/25" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isAuthenticated ? "Your Cart is Empty" : "Sign In to Shop"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {isAuthenticated
              ? "Browse our catalogue and add items to your cart."
              : "Sign in to start shopping and manage your cart."}
          </p>
          <Button
            className="mt-6 font-semibold gradient-primary text-white rounded-xl"
            onClick={() =>
              navigate(
                isAuthenticated
                  ? "/products"
                  : `/login?returnTo=${encodeURIComponent("/cart")}`
              )
            }
          >
            {isAuthenticated ? "Browse Medicines" : "Sign In"}
          </Button>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
