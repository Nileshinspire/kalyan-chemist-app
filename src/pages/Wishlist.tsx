import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";

export default function Wishlist() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
          <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Heart className="size-7 text-muted-foreground/40" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Your Wishlist</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {isAuthenticated
              ? "Wishlist will be available in Phase 2."
              : "Sign in to see and manage your saved medicines."}
          </p>
          <Button
            className="mt-6 font-semibold"
            onClick={() =>
              navigate(isAuthenticated ? "/products" : `/login?returnTo=/wishlist`)
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
