import { useQuery } from "convex/react";
import { BadgePercent, Tag } from "lucide-react";
import { api } from "@/convex/_generated/api";
import ProductCard from "@/components/ProductCard";

/* ─── Minimum N% Off — the admin-configured exact-discount section ───
 * Replaces the old "What Our Customers Say" band on the homepage.
 *
 * Everything here comes from `api.discountHighlights.getPublic`, which lists
 * the products the discount engine prices at the configured percentage or
 * better, across every active product in every category — including products
 * created after the rule was saved. Nothing is hardcoded: the heading, the copy
 * and the grid all follow the percentage the admin saves in the Discount
 * Manager, and products are rendered through the shared `ProductCard` on the
 * shared `.kc-card-track`, so navigation, cart, wishlist and card dimensions
 * are the same as every other section.
 *
 * When nothing matches, the section shows a clean empty state instead of
 * anything that is not genuinely at that exact discount.
 */
export default function MinimumDiscount() {
  const section = useQuery(api.discountHighlights.getPublic);

  // Same loading behaviour as every other product section: nothing until the
  // real data arrives, so no wrong percentage is ever flashed. An admin that
  // has never saved a rule leaves the whole section out of the homepage.
  if (!section || !section.configured) return null;

  const percent = section.discountPercent;
  const products = section.products;

  if (percent < 1 || percent > 99) return null;

  return (
    <section className="border-y border-border/50 bg-gradient-to-b from-card/50 to-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-14">
        <div className="max-w-2xl">
          {/* Apollo-style compact heading on phones: pill + description render
              from `sm` up exactly as before. */}
          <div className="max-sm:hidden inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <BadgePercent className="size-3" />
            Exact Discount Deals
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-5xl max-sm:text-base max-sm:font-semibold max-sm:tracking-normal">
            Minimum {percent}% Off
          </h2>
          <p className="mt-2 text-sm sm:text-lg text-muted-foreground max-sm:hidden">
            Every product here is at least {percent}% below its MRP — priced and
            kept current by our discount engine.
          </p>
        </div>

        {products.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 kc-card-track">
            {products.map((product) => (
              <ProductCard key={product._id} product={product as any} />
            ))}
          </div>
        ) : (
          <div className="mt-6 sm:mt-8 rounded-2xl border border-dashed border-border/70 bg-card/60 px-6 py-10 text-center">
            <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Tag className="size-5" />
            </span>
            <p className="text-sm font-semibold text-foreground sm:text-base">
              No products are at {percent}% off or better right now.
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground sm:text-sm">
              We only list products that are genuinely {percent}% or more below
              MRP, so this space stays empty until one qualifies. Please check
              back soon.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
