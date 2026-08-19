// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useConvexQuery: vi.fn(() => undefined),
  useConvexMutation: vi.fn(() => vi.fn()),
  ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { MemoryRouter } from "react-router";
import React from "react";

// Helper to wrap components in MemoryRouter for testing
export function renderWithRouter(ui: React.ReactElement, route = "/") {
  const { render, ...rest } = require("@testing-library/react");
  return render(
    <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
  );
}

// Mock react-router useNavigate and useParams (but keep MemoryRouter working)
vi.mock("react-router", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
    useParams: vi.fn(() => ({})),
    useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
  };
});

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    a: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => {
  const Proxy = new Proxy(
    {},
    {
      get: (_, prop) => {
        const Icon = (props: any) => <svg data-testid={`icon-${String(prop)}`} {...props} />;
        Icon.displayName = String(prop);
        return Icon;
      },
    }
  );
  return Proxy;
});

// Mock auth context
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock lib/auth-utils
vi.mock("@/lib/auth-utils", () => ({
  formatCurrency: vi.fn((amount: number) => `₹${amount.toFixed(2)}`),
}));

// Mock Convex generated API
vi.mock("@/convex/_generated/api", () => ({
  api: {
    cart: {
      list: "cart:list",
      getCount: "cart:getCount",
      addItem: "cart:addItem",
      updateQuantity: "cart:updateQuantity",
      removeItem: "cart:removeItem",
      clear: "cart:clear",
    },
    wishlist: {
      list: "wishlist:list",
      toggle: "wishlist:toggle",
      remove: "wishlist:remove",
      moveToCart: "wishlist:moveToCart",
      getCount: "wishlist:getCount",
      isWishlisted: "wishlist:isWishlisted",
    },
    products: {
      list: "products:list",
      getBySlug: "products:getBySlug",
    },
  },
}));
