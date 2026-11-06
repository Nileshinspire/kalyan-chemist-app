import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";

const { saveTheme } = vi.hoisted(() => ({
  saveTheme: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => saveTheme,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, isAdmin: true, user: { _id: "u1" } }),
}));

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";

function renderWithTheme(node: React.ReactNode) {
  return render(
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="kc_theme_test"
    >
      {node}
    </ThemeProvider>,
  );
}

beforeEach(() => {
  saveTheme.mockClear();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("theme toggle", () => {
  it("applies dark mode immediately and saves the customer preference", async () => {
    renderWithTheme(<ThemeToggle scope="customer" />);

    fireEvent.click(screen.getByRole("button", { name: /dark/i }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    await waitFor(() => {
      expect(saveTheme).toHaveBeenCalledWith({ theme: "dark", scope: "customer" });
    });
    expect(screen.getByRole("button", { name: /dark/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /light/i }));
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
    expect(saveTheme).toHaveBeenCalledWith({ theme: "light", scope: "customer" });
  });

  it("saves the admin panel preference independently", async () => {
    renderWithTheme(<ThemeSwitch scope="admin" />);

    fireEvent.click(screen.getByRole("switch", { name: /dark mode/i }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    await waitFor(() => {
      expect(saveTheme).toHaveBeenCalledWith({ theme: "dark", scope: "admin" });
    });
  });

  it("keeps working locally when saving to the account fails", async () => {
    saveTheme.mockRejectedValueOnce(new Error("network"));
    renderWithTheme(<ThemeToggle scope="customer" />);

    fireEvent.click(screen.getByRole("button", { name: /dark/i }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });
});
