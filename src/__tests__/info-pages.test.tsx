import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// The page shell only needs routing; the header is covered elsewhere and
// pulls in auth state, so it is stubbed for these content smoke tests.
vi.mock("@/components/layout/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

import ContactUs from "@/pages/ContactUs";
import Faqs from "@/pages/Faqs";
import WhyChooseUs from "@/pages/WhyChooseUs";
import Careers from "@/pages/Careers";
import Sitemap from "@/pages/Sitemap";
import PolicyPage from "@/pages/PolicyPage";
import { POLICIES, type PolicyId } from "@/data/policies";

function renderPage(ui: React.ReactElement, route = "/") {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

function expectNoDeadLinks() {
  document.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    expect(href).not.toBe("");
    expect(href).not.toBe("#");
    expect(href.startsWith("javascript:")).toBe(false);
  });
}

describe("Footer-linked informational pages", () => {
  it("renders Contact Us with every contact channel", () => {
    renderPage(<ContactUs />, "/contact-us");
    expect(
      screen.getByRole("heading", { level: 1, name: /Contact Kalyan Chemist/ })
    ).toBeInTheDocument();
    // Shown both on the page and in the shared footer
    expect(screen.getAllByText("hello@kalyanchemist.in").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+91 98765 43210").length).toBeGreaterThan(0);

    const hrefs = Array.from(document.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("tel:+919876543210");
    expect(hrefs).toContain("mailto:hello@kalyanchemist.in");
    expect(hrefs.some((h) => h?.startsWith("https://wa.me/919876543210"))).toBe(
      true
    );
    expectNoDeadLinks();
  });

  it("renders the FAQ page with accordion questions", () => {
    renderPage(<Faqs />, "/faqs");
    expect(
      screen.getByRole("heading", { level: 1, name: /Frequently Asked Questions/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText("How do I track my order?")
    ).toBeInTheDocument();
    expectNoDeadLinks();
  });

  it("renders the Why Choose Us page", () => {
    renderPage(<WhyChooseUs />, "/why-choose-us");
    expect(
      screen.getByRole("heading", { level: 1, name: /Healthcare you can rely on/ })
    ).toBeInTheDocument();
    expect(screen.getByText("Authentic Medicines")).toBeInTheDocument();
    expectNoDeadLinks();
  });

  it("renders Careers without inventing vacancies", () => {
    renderPage(<Careers />, "/careers");
    expect(
      screen.getByRole("heading", { level: 1, name: /Careers at Kalyan Chemist/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/do not have any positions listed/i)
    ).toBeInTheDocument();
    expectNoDeadLinks();
  });

  it("renders the Sitemap with only public routes", () => {
    renderPage(<Sitemap />, "/sitemap");
    expect(
      screen.getByRole("heading", { level: 1, name: "Sitemap" })
    ).toBeInTheDocument();

    const hrefs = Array.from(document.querySelectorAll("a")).map(
      (a) => a.getAttribute("href") ?? ""
    );
    expect(hrefs).toContain("/privacy-policy");
    expect(hrefs).toContain("/account/orders");
    // Admin / internal areas must never be exposed
    expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false);
    expectNoDeadLinks();
  });

  it("renders every policy page with its own content", () => {
    (Object.keys(POLICIES) as PolicyId[]).forEach((policyId) => {
      const { unmount } = renderPage(
        <PolicyPage policyId={policyId} />,
        `/${policyId}`
      );
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: POLICIES[policyId].title,
        })
      ).toBeInTheDocument();
      expectNoDeadLinks();
      unmount();
    });
  });
});
