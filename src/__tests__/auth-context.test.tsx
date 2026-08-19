import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { type ReactNode } from "react";

// Mock the Convex auth hook before importing AuthContext
const mockSignOut = vi.fn();
let mockIsAuthenticated = false;
let mockIsLoading = false;
let mockUser: Record<string, unknown> | null = null;

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isLoading: mockIsLoading,
    isAuthenticated: mockIsAuthenticated,
    user: mockUser,
    signIn: vi.fn(),
    signOut: mockSignOut,
  }),
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockIsLoading = false;
    mockUser = null;
  });

  it("exposes isLoading=true when Convex is loading", () => {
    mockIsLoading = true;
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("exposes isAuthenticated=false when no user", () => {
    mockIsAuthenticated = false;
    mockUser = null;
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("exposes isAuthenticated=true when Convex has a session", () => {
    mockIsAuthenticated = true;
    mockUser = { _id: "u1", email: "test@test.com", role: "customer" };
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("exposes isAdmin=true when user role is admin", () => {
    mockIsAuthenticated = true;
    mockUser = { _id: "u1", email: "admin@test.com", role: "admin" };
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAdmin).toBe(true);
  });

  it("exposes isAdmin=false when user role is customer", () => {
    mockIsAuthenticated = true;
    mockUser = { _id: "u1", email: "user@test.com", role: "customer" };
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAdmin).toBe(false);
  });

  it("exposes user from Convex query", () => {
    mockIsAuthenticated = true;
    mockUser = { _id: "u123", name: "Priya", email: "priya@test.com" };
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user?._id).toBe("u123");
    expect(result.current.user?.name).toBe("Priya");
  });

  it("login() throws error (password auth not supported)", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.login("a@b.com", "pass")
    ).rejects.toThrow("email verification");
  });

  it("register() throws error (redirects to /auth)", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.register({ name: "X", email: "a@b.com", password: "pass" })
    ).rejects.toThrow("email verification");
  });

  it("logout() calls Convex signOut", async () => {
    mockSignOut.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.logout();
    });
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("refreshUser() is a no-op (Convex is reactive)", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    // Should not throw
    await act(async () => {
      await result.current.refreshUser();
    });
  });
});
