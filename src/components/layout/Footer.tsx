import { memo } from "react";
import { useNavigate } from "react-router";
import { Phone, MapPin, Mail, Clock, ArrowUpRight, Heart } from "lucide-react";

const Footer = memo(function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border/40 bg-card/60 backdrop-blur-sm mt-auto">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl gradient-primary text-white font-bold text-sm shadow-glow">
                KC
              </div>
              <div className="leading-tight">
                <span className="text-base font-bold tracking-tight">
                  Kalyan Chemist
                </span>
                <span className="block text-[10px] font-medium uppercase tracking-widest text-primary/60">
                  Trusted Pharmacy
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Your trusted neighbourhood pharmacy, now available online. Genuine
              medicines, delivered with care to your doorstep.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                <span>Mon – Sat, 8 AM – 10 PM</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-foreground">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button
                  className="flex items-center gap-1 hover:text-primary transition-colors duration-200 group cursor-pointer"
                  onClick={() => navigate("/")}
                >
                  Home
                  <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </button>
              </li>
              <li>
                <button
                  className="flex items-center gap-1 hover:text-primary transition-colors duration-200 group cursor-pointer"
                  onClick={() => navigate("/products")}
                >
                  All Medicines
                  <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </button>
              </li>
              <li>
                <button
                  className="flex items-center gap-1 hover:text-primary transition-colors duration-200 group cursor-pointer"
                  onClick={() => navigate("/cart")}
                >
                  Shopping Cart
                  <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </button>
              </li>
              <li>
                <button
                  className="flex items-center gap-1 hover:text-primary transition-colors duration-200 group cursor-pointer"
                  onClick={() => navigate("/auth")}
                >
                  Sign In
                  <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </button>
              </li>
              <li>
                <button
                  className="flex items-center gap-1 hover:text-primary transition-colors duration-200 group cursor-pointer"
                  onClick={() => navigate("/auth")}
                >
                  Create Account
                  <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </button>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-foreground">
              Categories
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {[
                { name: "Pain & Relief", slug: "pain-relief" },
                { name: "Heart & Cardio", slug: "heart-cardio" },
                { name: "Diabetes Care", slug: "diabetes-care" },
                { name: "Vitamins & Supplements", slug: "vitamins-supplements" },
                { name: "Baby & Mother", slug: "baby-mother" },
                { name: "Mind & Neurology", slug: "mind-neurology" },
              ].map((cat) => (
                <li key={cat.slug}>
                  <button
                    className="flex items-center gap-1 hover:text-primary transition-colors duration-200 group cursor-pointer"
                    onClick={() =>
                      navigate(`/products?category=${cat.slug}`)
                    }
                  >
                    {cat.name}
                    <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-foreground">
              Contact Us
            </h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="size-3.5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">+91 98765 43210</p>
                  <p className="text-xs text-muted-foreground/70">Mon – Sat, 8 AM – 10 PM</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                  <MapPin className="size-3.5" />
                </div>
                <div>
                  <p className="leading-relaxed">
                    123 Health Street,
                    <br />
                    Mumbai, Maharashtra 400001
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="size-3.5" />
                </div>
                <p>hello@kalyanchemist.in</p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Kalyan Chemist. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Made with <Heart className="size-3 fill-red-400 text-red-400" /> for better healthcare
          </p>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
