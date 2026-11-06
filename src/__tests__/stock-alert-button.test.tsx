import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { requestNotification, cancelNotification, waitingState } = vi.hoisted(() => ({
  requestNotification: vi.fn().mockResolvedValue({ success: true, alreadyWaiting: false }),
  cancelNotification: vi.fn().mockResolvedValue({ success: true }),
  waitingState: { value: false as boolean | undefined },
}));

const fnName = (reference: any) => reference?.[Symbol.for("functionName")];

vi.mock("convex/react", () => ({
  useQuery: () => waitingState.value,
  useMutation: (mutation: unknown) =>
    fnName(mutation) === "availabilityNotifications:cancelNotification"
      ? cancelNotification
      : requestNotification,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, isAdmin: false, user: { _id: "u1" } }),
}));

import { StockAlertButton } from "@/components/product/StockAlertButton";

const PRODUCT_ID = "p1" as any;

function renderButton() {
  return render(
    <MemoryRouter>
      <StockAlertButton productId={PRODUCT_ID} productName="Metformin 500 mg" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  requestNotification.mockClear();
  cancelNotification.mockClear();
  waitingState.value = false;
});

describe("Notify Me When Available", () => {
  it("subscribes the signed-in customer to the product", async () => {
    renderButton();

    const button = screen.getByRole("button", { name: /notify me when available/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(requestNotification).toHaveBeenCalledWith({ productId: PRODUCT_ID });
    });
  });

  it("shows the waiting state and lets the customer cancel", async () => {
    waitingState.value = true;
    renderButton();

    expect(document.body.textContent).toMatch(/website notification when/i);
    expect(document.body.textContent).toMatch(/Metformin 500 mg/);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(cancelNotification).toHaveBeenCalledWith({ productId: PRODUCT_ID });
    });
  });

  it("only notifies on the website (no WhatsApp/email claim)", () => {
    renderButton();
    expect(screen.getByText(/no WhatsApp or email/i)).toBeTruthy();
  });
});
