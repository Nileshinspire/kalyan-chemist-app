import { useNavigate } from "react-router";
import { Phone, MapPin } from "lucide-react";

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border/60 bg-card mt-auto">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                KC
              </div>
              <span className="text-base font-bold tracking-tight">
                Kalyan Chemist
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your trusted neighbourhood pharmacy, now available online. Genuine
              medicines, delivered with care.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate("/")}
              >
                Home
              </li>
              <li
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate("/products")}
              >
                All Medicines
              </li>
              <li
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate("/cart")}
              >
                Shopping Cart
              </li>
              <li
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate("/auth")}
              >
                Sign In
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              Categories
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate("/products?category=pain-relief")}
              >
                Pain & Relief
              </li>
              <li
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate("/products?category=heart-cardio")}
              >
                Heart & Cardio
              </li>
              <li
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate("/products?category=diabetes-care")}
              >
                Diabetes Care
              </li>
              <li
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() =>
                  navigate("/products?category=vitamins-supplements")
                }
              >
                Vitamins & Supplements
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              Contact
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0" />
                +91 98765 43210
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="size-4 shrink-0 mt-0.5" />
                <span>
                  123 Health Street,
                  <br />
                  Mumbai, Maharashtra 400001
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6 py-5 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Kalyan Chemist. All rights reserved.
          Licensed Pharmacy.
        </div>
      </div>
    </footer>
  );
}
