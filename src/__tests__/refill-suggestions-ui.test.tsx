import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { rows } = vi.hoisted(() => ({
  rows: { value: [] as any[] },
}));

vi.mock("convex/react", () => ({
  useQuery: () => rows.value,
  useMutation: () => vi.fn().mockResolvedValue({ success: true }),
}));

import { RefillSuggestions } from "@/components/account/RefillSuggestions";

const NOW = Date.now();

function makeRow(overrides: Record<string, any> = {}) {
  return {
    productId: "p1",
    lastOrderAt: NOW - 20 * 24 * 60 * 60 * 1000,
    orderCount: 2,
    hasManualReminder: false,
    product: {
      _id: "p1",
      name: "Metformin 500 mg",
      slug: "metformin",
      imageUrl: null,
      manufacturer: "Sun Pharma",
      packSize: "15 tablets",
      strength: "500 mg",
      price: 120,
      discountPrice: 99,
      stockQuantity: 10,
      prescriptionRequired: true,
      isActive: true,
      expiryDate: null,
    },
    suggestion: null,
    ...overrides,
  };
}

function renderSection() {
  return render(
    <MemoryRouter>
      <RefillSuggestions />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  rows.value = [];
});

describe("Proactive Refill Reminders", () => {
  it("is visible with a helpful empty state when there is no order history", () => {
    renderSection();
    expect(screen.getByText("Proactive Refill Reminders")).toBeTruthy();
    expect(screen.getByText(/No refill suggestions yet/i)).toBeTruthy();
    expect(screen.getByText(/you choose the timing/i)).toBeTruthy();
  });

  it("offers a refill reminder for a previously ordered medicine", () => {
    rows.value = [makeRow()];
    renderSection();

    expect(screen.getByText("Metformin 500 mg")).toBeTruthy();
    expect(screen.getByRole("button", { name: /set refill reminder/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /set refill reminder/i }));
    expect(screen.getByText(/Refill reminder for Metformin 500 mg/i)).toBeTruthy();
    expect(screen.getByText(/we won’t guess|we won't guess/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  });

  it("never offers a second reminder for a medicine already tracked manually", () => {
    rows.value = [makeRow({ hasManualReminder: true })];
    renderSection();

    expect(screen.queryByRole("button", { name: /set refill reminder/i })).toBeNull();
    expect(screen.getByText(/already tracked/i)).toBeTruthy();
  });

  it("shows an enabled reminder's due date and a Reorder action", () => {
    rows.value = [
      makeRow({
        suggestion: {
          _id: "s1",
          status: "enabled",
          intervalDays: 30,
          nextReminderAt: NOW - 24 * 60 * 60 * 1000,
        },
      }),
    ];
    renderSection();

    expect(screen.getByText(/Due now/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /reorder/i })).toBeTruthy();
    expect(screen.getByText(/every 30 days/i)).toBeTruthy();
  });
});
