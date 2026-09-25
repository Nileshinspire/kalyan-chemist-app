import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

/* ═══════════════════════════════════════════════════════════════════════════
   Shared shell for the informational pages linked from the footer
   (About/Contact/FAQs/Why Choose Us/Careers/Sitemap and every policy page).

   Keeps the existing Kalyan Chemist page conventions — Navbar, a light
   gradient hero band, a readable max-width content column, then the Footer —
   so all footer-linked pages stay visually consistent and responsive without
   touching the global design system.
   ═══════════════════════════════════════════════════════════════════════════ */

interface InfoPageProps {
  badge?: string;
  badgeIcon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Optional content rendered on the hero band (e.g. CTAs) */
  heroExtra?: ReactNode;
  children: ReactNode;
}

export default function InfoPage({
  badge,
  badgeIcon,
  title,
  subtitle,
  heroExtra,
  children,
}: InfoPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <section className="border-b border-border/30 bg-gradient-to-b from-primary/[0.04] to-transparent">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-9 sm:py-14">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {badge && (
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  {badgeIcon}
                  {badge}
                </span>
              )}
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {subtitle}
                </p>
              )}
              {heroExtra && <div className="mt-5">{heroExtra}</div>}
            </motion.div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-9 sm:py-12">{children}</div>
      </main>

      <Footer />
    </div>
  );
}
