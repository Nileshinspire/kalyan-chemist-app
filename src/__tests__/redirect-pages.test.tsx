import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { type ReactNode } from "react";

// Mock heavy deps
vi.mock("lucide-react", () => ({
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
  Mail: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Lock: () => null,
  User: () => null,
  Phone: () => null,
  ShieldCheck: () => null,
}));

// Mock AuthContext — not authenticated
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import AdminLoginPage from "@/pages/AdminLogin";

function renderWithRouter(ui: ReactNode, initialRoute: string) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/auth" element={<div>Auth Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/admin" element={<div>Admin</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Login page redirects to /auth", () => {
  it("redirects to /auth with returnTo=/dashboard", async () => {
    renderWithRouter(<LoginPage />, "/login");
    await waitFor(() => {
      expect(screen.getByText("Auth Page")).toBeInTheDocument();
    });
  });
});

describe("Register page redirects to /auth", () => {
  it("redirects to /auth with returnTo=/dashboard", async () => {
    renderWithRouter(<RegisterPage />, "/register");
    await waitFor(() => {
      expect(screen.getByText("Auth Page")).toBeInTheDocument();
    });
  });
});

describe("AdminLogin page redirects to /auth", () => {
  it("redirects to /auth when not authenticated", async () => {
    renderWithRouter(<AdminLoginPage />, "/admin/login");
    await waitFor(() => {
      expect(screen.getByText("Auth Page")).toBeInTheDocument();
    });
  });
});
