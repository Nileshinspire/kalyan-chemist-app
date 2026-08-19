import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const mainTsx = readFileSync(
  resolve(__dirname, "../main.tsx"),
  "utf-8"
);

describe("main.tsx provider hierarchy", () => {
  it("imports ConvexAuthProvider from @convex-dev/auth/react", () => {
    expect(mainTsx).toContain(
      'import { ConvexAuthProvider } from "@convex-dev/auth/react"'
    );
  });

  it("imports ConvexReactClient from convex/react", () => {
    expect(mainTsx).toContain(
      'import { ConvexReactClient } from "convex/react"'
    );
  });

  it("creates a ConvexReactClient instance", () => {
    expect(mainTsx).toContain("new ConvexReactClient(");
    expect(mainTsx).toContain("VITE_CONVEX_URL");
  });

  it("wraps app with ConvexAuthProvider before AuthProvider", () => {
    const convexIdx = mainTsx.indexOf("<ConvexAuthProvider");
    const authIdx = mainTsx.indexOf("<AuthProvider>");
    expect(convexIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeGreaterThan(-1);
    expect(convexIdx).toBeLessThan(authIdx);
  });

  it("closes ConvexAuthProvider after AuthProvider", () => {
    const authCloseIdx = mainTsx.indexOf("</AuthProvider>");
    const convexCloseIdx = mainTsx.indexOf("</ConvexAuthProvider>");
    expect(authCloseIdx).toBeGreaterThan(-1);
    expect(convexCloseIdx).toBeGreaterThan(-1);
    expect(authCloseIdx).toBeLessThan(convexCloseIdx);
  });

  it("includes /auth route", () => {
    expect(mainTsx).toContain('path="/auth"');
  });

  it("lazy-loads Auth component", () => {
    expect(mainTsx).toContain('lazy(() => import("./pages/Auth.tsx"))');
  });

  it("includes all required routes", () => {
    const requiredRoutes = [
      'path="/"',
      'path="/auth"',
      'path="/login"',
      'path="/register"',
      'path="/admin/login"',
      'path="/dashboard"',
      'path="/products"',
      'path="/cart"',
      'path="/admin"',
    ];
    for (const route of requiredRoutes) {
      expect(mainTsx).toContain(route);
    }
  });

  it("protects /dashboard with RequireAuth", () => {
    const dashIdx = mainTsx.indexOf('path="/dashboard"');
    const requireAuthIdx = mainTsx.indexOf("<RequireAuth>", dashIdx);
    // RequireAuth should appear after the dashboard route and before the Dashboard component
    expect(requireAuthIdx).toBeGreaterThan(dashIdx);
    expect(requireAuthIdx).toBeLessThan(
      mainTsx.indexOf("<Dashboard />", dashIdx)
    );
  });

  it("protects /admin with RequireAuth adminOnly", () => {
    const adminIdx = mainTsx.indexOf('path="/admin"');
    const adminOnlyIdx = mainTsx.indexOf("adminOnly", adminIdx);
    expect(adminOnlyIdx).toBeGreaterThan(-1);
  });
});
