import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { type ReactNode } from "react";

// Mock heavy dependencies to avoid pre-bundling timeout
vi.mock("lucide-react", () => ({
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" className="animate-spin" {...props} />
  ),
}));

// Mock AuthContext
let mockAuthState = {
  isLoading: false,
  isAuthenticated: false,
  isAdmin: false,
};

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

import { RequireAuth } from "@/components/RequireAuth";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/dashboard"]}>{children}</MemoryRouter>
  );
}

function adminWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/admin"]}>{children}</MemoryRouter>
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    mockAuthState = { isLoading: false, isAuthenticated: false, isAdmin: false };
  });

  it("shows loading spinner when isLoading is true", () => {
    mockAuthState = { isLoading: true, isAuthenticated: false, isAdmin: false };
    render(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>,
      { wrapper }
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("redirects to /login when not authenticated (customer route)", () => {
    render(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>,
      { wrapper }
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to /admin/login when not authenticated (admin route)", () => {
    render(
      <RequireAuth adminOnly>
        <div>Admin Content</div>
      </RequireAuth>,
      { adminWrapper }
    );
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("shows Access Denied when authenticated but not admin (adminOnly)", () => {
    mockAuthState = { isLoading: false, isAuthenticated: true, isAdmin: false };
    render(
      <RequireAuth adminOnly>
        <div>Admin Content</div>
      </RequireAuth>,
      { adminWrapper }
    );
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  it("renders children when authenticated (non-admin route)", () => {
    mockAuthState = { isLoading: false, isAuthenticated: true, isAdmin: false };
    render(
      <RequireAuth>
        <div>Dashboard Content</div>
      </RequireAuth>,
      { wrapper }
    );
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });

  it("renders children when authenticated as admin (adminOnly route)", () => {
    mockAuthState = { isLoading: false, isAuthenticated: true, isAdmin: true };
    render(
      <RequireAuth adminOnly>
        <div>Admin Dashboard</div>
      </RequireAuth>,
      { adminWrapper }
    );
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });
});
