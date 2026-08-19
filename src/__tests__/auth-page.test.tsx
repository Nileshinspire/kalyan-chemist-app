import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { type ReactNode } from "react";

// Mock heavy deps
vi.mock("lucide-react", () => ({
  ArrowRight: () => null,
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
  Mail: () => null,
}));

// Mock use-auth hook (Convex auth)
const mockSignIn = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: false,
    signIn: mockSignIn,
    signOut: vi.fn(),
    user: null,
  }),
}));

import AuthPage from "@/pages/Auth";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/auth"]}>{children}</MemoryRouter>
  );
}

describe("AuthPage (OTP sign-in)", () => {
  it("renders the Kalyan Chemist branding", () => {
    render(<AuthPage />, { wrapper });
    expect(screen.getByText("Kalyan Chemist")).toBeInTheDocument();
  });

  it("renders the welcome card", () => {
    render(<AuthPage />, { wrapper });
    expect(screen.getByText("Welcome to Kalyan Chemist")).toBeInTheDocument();
  });

  it("shows email input prompt", () => {
    render(<AuthPage />, { wrapper });
    expect(screen.getByText(/Enter your email address/)).toBeInTheDocument();
  });

  it("has an email input field", () => {
    render(<AuthPage />, { wrapper });
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("does NOT show OTP input initially", () => {
    render(<AuthPage />, { wrapper });
    expect(screen.queryByText("Check Your Inbox")).not.toBeInTheDocument();
  });

  it("has a Trusted Pharmacy tagline", () => {
    render(<AuthPage />, { wrapper });
    expect(screen.getByText("Trusted Pharmacy")).toBeInTheDocument();
  });
});
