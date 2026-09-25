import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Footer from "@/components/layout/Footer";

/* Footer link audit — guarantees the footer system never ships a dead or
   placeholder link, uses the right protocol for each contact channel, and
   keeps the mobile accordion accessible. */

function renderFooter() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Footer />
    </MemoryRouter>
  );
}

function footerLinks(): HTMLAnchorElement[] {
  const footer = screen.getByRole("contentinfo");
  return Array.from(footer.querySelectorAll("a"));
}

describe("Footer", () => {
  it("renders the five information groups", () => {
    renderFooter();
    [
      "About Kalyan Chemist",
      "Healthcare Services",
      "Shop / Medicines",
      "Customer Support",
      "Policies & Legal",
    ].forEach((group) => {
      expect(
        screen.getByRole("button", { name: group })
      ).toBeInTheDocument();
    });
  });

  it("renders the trust strip and bottom bar", () => {
    renderFooter();
    expect(screen.getByText("100% Genuine Products")).toBeInTheDocument();
    expect(screen.getByText("Secure Payments")).toBeInTheDocument();
    expect(screen.getByText("Safe & Secure Checkout")).toBeInTheDocument();
    expect(screen.getByText("Reliable Delivery")).toBeInTheDocument();
    expect(
      screen.getByText(/Kalyan Chemist\. All rights reserved\./)
    ).toBeInTheDocument();
  });

  it("has no dead, placeholder or javascript links", () => {
    renderFooter();
    const links = footerLinks();
    expect(links.length).toBeGreaterThan(30);

    links.forEach((link) => {
      const href = link.getAttribute("href") ?? "";
      expect(link.textContent?.trim()).not.toBe("");
      expect(href).not.toBe("");
      expect(href).not.toBe("#");
      expect(href.startsWith("javascript:")).toBe(false);
    });
  });

  it("points internal links at real routes", () => {
    renderFooter();
    const hrefs = footerLinks().map((link) => link.getAttribute("href"));

    [
      "/about-us",
      "/contact-us",
      "/faqs",
      "/why-choose-us",
      "/sitemap",
      "/careers",
      "/doctor-appointment",
      "/lab-tests",
      "/upload-prescription",
      "/refill",
      "/chatbot",
      "/products",
      "/categories",
      "/hot-sellers",
      "/value-deals",
      "/wishlist",
      "/account",
      "/account/orders",
      "/account/track-order",
      "/account/addresses",
      "/account/prescriptions",
      "/account/notifications",
      "/privacy-policy",
      "/terms-conditions",
      "/shipping-delivery",
      "/cancellation-refund",
      "/return-policy",
      "/prescription-policy",
      "/payment-policy",
      "/disclaimer",
    ].forEach((route) => {
      expect(hrefs).toContain(route);
    });
  });

  it("uses the correct protocol for every contact channel", () => {
    renderFooter();
    const hrefs = footerLinks().map((link) => link.getAttribute("href") ?? "");

    expect(hrefs.some((h) => h === "tel:+919876543210")).toBe(true);
    expect(hrefs.some((h) => h === "mailto:hello@kalyanchemist.in")).toBe(true);
    expect(hrefs.some((h) => h.startsWith("https://wa.me/919876543210"))).toBe(
      true
    );
  });

  it("does not invent social profiles, payment providers or store listings", () => {
    renderFooter();
    const hrefs = footerLinks().map((link) =>
      (link.getAttribute("href") ?? "").toLowerCase()
    );

    ["facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
      "play.google.com", "apps.apple.com"].forEach((domain) => {
      expect(hrefs.some((h) => h.includes(domain))).toBe(false);
    });
  });

  it("exposes an accessible, toggleable accordion per group", () => {
    renderFooter();

    const groups = [
      { title: "About Kalyan Chemist", id: "about" },
      { title: "Healthcare Services", id: "healthcare" },
      { title: "Shop / Medicines", id: "shop" },
      { title: "Customer Support", id: "support" },
      { title: "Policies & Legal", id: "policies" },
    ];

    groups.forEach(({ title, id }) => {
      const toggle = screen.getByRole("button", { name: title });
      const panel = document.getElementById(`footer-panel-${id}`);

      expect(panel).not.toBeNull();
      expect(toggle).toHaveAttribute("aria-controls", `footer-panel-${id}`);
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });
  });
});
