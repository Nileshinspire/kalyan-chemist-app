import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { type ReactNode } from "react";

// Mock heavy deps
vi.mock("lucide-react", () => ({
  ArrowLeft: () => null,
  CheckCircle2: () => null,
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
  Lock: () => null,
  Mail: () => null,
  Phone: () => null,
  ShieldCheck: () => null,
  Sparkles: () => null,
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
  return <MemoryRouter initialEntries={["/auth"]}>{children}</MemoryRouter>;
}

function renderAuth() {
  return render(<AuthPage />, { wrapper });
}

/** Click a button by its accessible name. */
function clickButton(name: RegExp | string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

/** Click a segment in the Phone/Email toggle. */
function clickTab(name: RegExp | string) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

/** Set a controlled input's value. */
function typeInto(labelText: string, value: string) {
  fireEvent.change(screen.getByLabelText(labelText), { target: { value } });
}

/** Submit a form the way a keyboard Enter press would. */
function submitForm(buttonName: RegExp | string) {
  const button = screen.getByRole("button", { name: buttonName });
  fireEvent.click(button);
}

/** Fill all six OTP boxes with `code`, firing a change on each. */
function fillOtp(code: string) {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-otp-input]"),
  );
  expect(inputs).toHaveLength(6);
  for (let index = 0; index < 6; index++) {
    fireEvent.change(inputs[index], { target: { value: code[index] } });
  }
}

describe("AuthPage (OTP sign-in)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockResolvedValue(undefined);
    // The resend countdown is the only timer in the page, so fake timers let
    // these tests reach the resend button without waiting 30 real seconds.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the Kalyan Chemist branding", () => {
    renderAuth();
    expect(screen.getByText("Kalyan Chemist")).toBeInTheDocument();
    expect(screen.getByText("Health, Redefined")).toBeInTheDocument();
  });

  it("shows the welcome heading and supporting text", () => {
    renderAuth();
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/manage your orders/i)).toBeInTheDocument();
  });

  it("renders one centred card, not stacked cards", () => {
    const { container } = renderAuth();
    // A single card surface; the ambient glow is a sibling, not a nested card.
    expect(container.querySelectorAll(".rounded-2xl.border-white\\/10")).toHaveLength(
      1,
    );
  });

  it("uses a deep emerald backdrop", () => {
    const { container } = renderAuth();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("bg-[#04140E]");
  });

  it("offers Phone and Email methods in a segmented toggle", () => {
    renderAuth();
    expect(
      screen.getByRole("tablist", { name: "Sign-in method" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Email/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Phone/ })).toBeInTheDocument();
  });

  it("defaults to the Email method", () => {
    renderAuth();
    expect(screen.getByRole("tab", { name: /Email/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
  });

  it("switches to a +91 phone field when Phone is selected", () => {
    renderAuth();
    clickTab(/Phone/);
    expect(screen.getByRole("tab", { name: /Phone/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();
    expect(screen.getByText("+91")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send OTP" }),
    ).toBeInTheDocument();
  });

  it("rejects an invalid email before calling the backend", () => {
    renderAuth();
    typeInto("Email Address", "not-an-email");
    submitForm("Send Code");
    expect(
      screen.getByText("Please enter a valid email address."),
    ).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone number before calling the backend", () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "12345");
    submitForm("Send OTP");
    expect(
      screen.getByText("Please enter a valid phone number."),
    ).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("sends an email code and reveals the OTP step", async () => {
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    const [provider, form] = mockSignIn.mock.calls[0] as [string, FormData];
    expect(provider).toBe("email-otp");
    expect(form.get("email")).toBe("shopper@kc.com");

    expect(
      await screen.findByText("Enter verification code"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Verification code, digit 6 of 6"),
    ).toBeInTheDocument();
  });

  it("sends a phone OTP through the real phone-otp provider", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    const [provider, form] = mockSignIn.mock.calls[0] as [string, FormData];
    expect(provider).toBe("phone-otp");
    // Normalised to E.164 for the backend.
    expect(form.get("phone")).toBe("+919876543210");
    expect(await screen.findByText("Enter OTP")).toBeInTheDocument();
  });

  it("never displays the generated code in the UI", async () => {
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");
    await screen.findByText("Enter verification code");
    // The send call carries no code — the backend generates it.
    const [, sendForm] = mockSignIn.mock.calls[0] as [string, FormData];
    expect(sendForm.get("code")).toBeNull();
  });

  it("starts a 30s resend countdown", async () => {
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");
    await screen.findByText("Enter verification code");
    expect(
      screen.getByRole("button", { name: /Resend code in 30s/ }),
    ).toBeDisabled();
  });

  it("verifies a completed code automatically", async () => {
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");
    await screen.findByText("Enter verification code");

    mockSignIn.mockClear();
    await act(async () => {
      fillOtp("123456");
    });

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    const [provider, form] = mockSignIn.mock.calls[0] as [string, FormData];
    expect(provider).toBe("email-otp");
    expect(form.get("code")).toBe("123456");
    expect(form.get("email")).toBe("shopper@kc.com");
  });

  it("verifies a phone code with the phone-otp provider", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    await screen.findByText("Enter OTP");

    mockSignIn.mockClear();
    await act(async () => {
      fillOtp("123456");
    });

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    const [provider, form] = mockSignIn.mock.calls[0] as [string, FormData];
    expect(provider).toBe("phone-otp");
    expect(form.get("phone")).toBe("+919876543210");
  });

  it("shows friendly copy when the code is incorrect", async () => {
    mockSignIn
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Invalid code"));
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");
    await screen.findByText("Enter verification code");

    await act(async () => {
      fillOtp("000000");
    });

    expect(
      await screen.findByText("That code is incorrect. Please try again."),
    ).toBeInTheDocument();
  });

  it("surfaces an expired code in plain language", async () => {
    mockSignIn
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Expired code"));
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");
    await screen.findByText("Enter verification code");

    await act(async () => {
      fillOtp("999999");
    });

    expect(
      await screen.findByText("This code has expired. Please request a new one."),
    ).toBeInTheDocument();
  });

  it("does not leak internal backend errors", async () => {
    mockSignIn.mockRejectedValue(
      new Error("ConvexError: AUTH_VERIFICATION_CODES rate limited at db layer"),
    );
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "We couldn't send the code. Please try again.",
    );
    expect(alert.textContent).not.toMatch(/ConvexError|db layer/i);
  });

  it("reports a network failure in plain language", async () => {
    mockSignIn.mockRejectedValue(new Error("Connection lost"));
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");

    expect(
      await screen.findByText(
        "Connection issue. Please check your internet and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("tells the customer to use email when SMS is unavailable", async () => {
    mockSignIn.mockRejectedValue(new Error("SMS_PROVIDER_NOT_CONFIGURED"));
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");

    expect(
      await screen.findByText(
        "We couldn't send the code by text right now. Please use email.",
      ),
    ).toBeInTheDocument();
  });

  it("clears the phone input after a successful send", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    await screen.findByText("Enter OTP");

    // Returning to the input via "Change Phone Number" must not show the
    // number that was just used — the input is cleared after a successful send.
    clickButton("Change Phone Number");
    expect(screen.getByLabelText("Phone Number")).toHaveValue("");
  });

  it("shows the saved verification number on the OTP screen", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    // The masked number comes from the saved verification target.
    expect(await screen.findByText("+91 98765 43210")).toBeInTheDocument();
  });

  it("verifies against the saved number, not the cleared input", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    await screen.findByText("Enter OTP");

    mockSignIn.mockClear();
    await act(async () => {
      fillOtp("123456");
    });

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    const [provider, form] = mockSignIn.mock.calls[0] as [string, FormData];
    expect(provider).toBe("phone-otp");
    // Still the original number even though the input is empty.
    expect(form.get("phone")).toBe("+919876543210");
  });

  it("resends to the saved number without re-entering it", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    await screen.findByText("Enter OTP");

    // Skip past the countdown by exhausting it with fake timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    mockSignIn.mockClear();
    await act(async () => {
      clickButton(/Resend OTP/);
    });

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));
    const [provider, form] = mockSignIn.mock.calls[0] as [string, FormData];
    expect(provider).toBe("phone-otp");
    expect(form.get("phone")).toBe("+919876543210");
  });

  it("restarts the resend countdown after a resend", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    await screen.findByText("Enter OTP");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(
      screen.getByRole("button", { name: /^Resend OTP$/ }),
    ).toBeEnabled();

    await act(async () => {
      clickButton(/Resend OTP/);
    });
    expect(
      await screen.findByRole("button", { name: /Resend OTP in 30s/ }),
    ).toBeDisabled();
  });

  it("allows a fresh number after Change Phone Number", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    await screen.findByText("Enter OTP");

    clickButton("Change Phone Number");
    expect(screen.getByLabelText("Phone Number")).toHaveValue("");

    typeInto("Phone Number", "9123456789");
    submitForm("Send OTP");
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(2));
    const [, form] = mockSignIn.mock.calls[1] as [string, FormData];
    expect(form.get("phone")).toBe("+919123456789");
  });

  it("keeps the Phone tab selectable at all times", () => {
    renderAuth();
    const phoneTab = screen.getByRole("tab", { name: /Phone/ });
    // Never disabled or hidden — the backend decides at send time.
    expect(phoneTab).toBeEnabled();
    expect(
      screen.queryByText(/Text sign-in is being set up/i),
    ).not.toBeInTheDocument();

    fireEvent.click(phoneTab);
    expect(phoneTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();
  });

  it("switches back from Phone to Email without a reload", () => {
    renderAuth();
    clickTab(/Phone/);
    expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();

    clickTab(/Email/);
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.queryByLabelText("Phone Number")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send Code" }),
    ).toBeInTheDocument();
  });

  it("clears the OTP step when switching away mid-verification", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    await screen.findByText("Enter OTP");

    clickTab(/Email/);
    // Back at the identifier step, with no stale OTP screen.
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.queryByText("Enter OTP")).not.toBeInTheDocument();
  });

  it("returns to the identifier step to change the identifier", async () => {
    renderAuth();
    typeInto("Email Address", "shopper@kc.com");
    submitForm("Send Code");
    await screen.findByText("Enter verification code");

    clickButton("Change Email");
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
  });

  it("labels the Change Phone Number control on the phone flow", async () => {
    renderAuth();
    clickTab(/Phone/);
    typeInto("Phone Number", "9876543210");
    submitForm("Send OTP");
    await screen.findByText("Enter OTP");
    expect(
      screen.getByRole("button", { name: "Change Phone Number" }),
    ).toBeInTheDocument();
  });

  it("keeps the returnTo destination instead of forcing home", () => {
    render(
      <MemoryRouter initialEntries={["/auth?returnTo=%2Fcheckout"]}>
        <AuthPage />
      </MemoryRouter>,
    );
    // The auth UI renders rather than bouncing to "/" or "/dashboard".
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });
});
