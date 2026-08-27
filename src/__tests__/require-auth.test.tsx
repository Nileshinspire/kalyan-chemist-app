import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { type ReactNode, type ComponentType } from "react";

// Mock heavy dependencies to avoid pre-bundling timeout
vi.mock("lucide-react", () => ({
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" className="animate-spin" {...props} />
  ),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@/hooks/useBrowserNotifications", () => ({
  useBrowserNotifications: vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {},
}));

// Mock react-router — mock ALL hooks used by RequireAuth, keep real components
vi.mock("react-router", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
    useLocation: vi.fn(() => ({ pathname: "/dashboard", search: "", hash: "", state: null, key: "default" })),
    useParams: vi.fn(() => ({})),
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  };
});

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

function createWrapper(initialEntry: string): ComponentType<{ children: ReactNode }> {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
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
      { wrapper: createWrapper("/dashboard") }
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("redirects to /login when not authenticated (customer route)", () => {
    render(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>,
      { wrapper: createWrapper("/dashboard") }
    );
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to /admin/login when not authenticated (admin route)", () => {
    render(
      <RequireAuth adminOnly>
        <div>Admin Content</div>
      </RequireAuth>,
      { wrapper: createWrapper("/admin") }
    );
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("shows Access Denied when authenticated but not admin (adminOnly)", () => {
    mockAuthState = { isLoading: false, isAuthenticated: true, isAdmin: false };
    render(
      <RequireAuth adminOnly>
        <div>Admin Content</div>
      </RequireAuth>,
      { wrapper: createWrapper("/admin") }
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
      { wrapper: createWrapper("/dashboard") }
    );
    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });

  it("renders children when authenticated as admin (adminOnly route)", () => {
    mockAuthState = { isLoading: false, isAuthenticated: true, isAdmin: true };
    render(
      <RequireAuth adminOnly>
        <div>Admin Dashboard</div>
      </RequireAuth>,
      { wrapper: createWrapper("/admin") }
    );
    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
  });
});
