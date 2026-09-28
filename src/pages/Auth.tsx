import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/auth/OtpInput";
import { SegmentedToggle } from "@/components/SegmentedToggle";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

type Method = "phone" | "email";
/** `identifier` collects the phone/email, `verify` collects the 6-digit code. */
type Stage = "identifier" | "verify";

const RESEND_SECONDS = 30;
const OTP_LENGTH = 6;

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

/** Indian mobile numbers: 10 digits starting 6-9. */
function isValidPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.replace(/\D/g, ""));
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function toTenDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

/**
 * Map a raw Convex/Convex Auth error into short, friendly copy. Anything we do
 * not recognise becomes a generic message so backend details are never shown.
 *
 * `method` is used as a last-resort fallback: because Convex may wrap or
 * truncate a server error, an unrecognised failure during a phone send still
 * reports the SMS-specific guidance rather than the generic email wording.
 */
function friendlyError(
  error: unknown,
  context: "send" | "verify",
  method: Method = "email",
): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/SMS_PROVIDER_NOT_CONFIGURED|SMS_SEND_FAILED/.test(message)) {
    return "We couldn't send the code by text right now. Please use email.";
  }
  if (/SMS_INVALID_PHONE/.test(message)) {
    return "Please enter a valid phone number.";
  }
  if (/Connection lost|WebSocket|network|Failed to fetch/i.test(message)) {
    return "Connection issue. Please check your internet and try again.";
  }
  // Match the customer-facing rate-limit wording, not any mention of
  // "rate limit" anywhere in an internal message, so backend phrasing such as
  // "rate limited at db layer" is not echoed back to the customer.
  if (/too many (attempts|requests)|rate limit exceeded/i.test(message)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (/expire/i.test(message)) {
    return "This code has expired. Please request a new one.";
  }
  if (context === "verify") {
    return "That code is incorrect. Please try again.";
  }
  if (method === "phone") {
    return "We couldn't send the code by text right now. Please use email.";
  }
  return "We couldn't send the code. Please try again.";
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  // Real SMS availability, reported by the server. `undefined` while loading.
  const [preferredMethod, setPreferredMethod] = useState<Method>("email");
  const [stage, setStage] = useState<Stage>("identifier");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  /**
   * The E.164 number a code was actually sent to. Kept separate from `phone`
   * so the editable input can be cleared after a successful request while
   * verification and resend still target the correct number.
   */
  const [verificationPhone, setVerificationPhone] = useState("");

  // Guards the auto-submit that fires when the last OTP box is filled, so a
  // single completed code cannot trigger two verification requests.
  const verifyingRef = useRef(false);

  // Both methods are always selectable. Whether SMS can actually be delivered is
  // decided by the backend provider at send time, so a missing SMS
  // configuration surfaces as a real error rather than a silently hidden tab.
  const method: Method = preferredMethod;

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  // Resend countdown. Runs only while a code is on screen and ticking down.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  /** Pretty-print a stored E.164 number for the verification screen. */
  const formatPhone = (value: string) =>
    `+91 ${value.replace(/^\+91/, "").replace(/(\d{5})(\d{5})/, "$1 $2")}`;

  const maskedTarget =
    method === "phone" ? formatPhone(verificationPhone) : email.trim();

  /**
   * The number a code should be sent to: while verifying (including resend) we
   * reuse the number the code was actually issued for, otherwise we validate
   * whatever the customer just typed.
   */
  const resolvePhoneTarget = (): string | null => {
    if (stage === "verify" && verificationPhone) return verificationPhone;
    if (!isValidPhone(phone)) return null;
    return `+91${toTenDigits(phone)}`;
  };

  const resetToIdentifier = useCallback(() => {
    setStage("identifier");
    setCode("");
    setError(null);
    setNotice(null);
    setResendIn(0);
    // Start a fresh number entry; the number never lingers in the input.
    setVerificationPhone("");
    verifyingRef.current = false;
  }, []);

  const switchMethod = (next: Method) => {
    setPreferredMethod(next);
    setStage("identifier");
    setCode("");
    setError(null);
    setNotice(null);
    setResendIn(0);
    setPhone("");
    setVerificationPhone("");
    verifyingRef.current = false;
  };

  /** Request a fresh code for the current method. Shared by Send + Resend. */
  const sendCode = useCallback(
    async (isResend: boolean) => {
      if (isSubmitting) return;

      const phoneTarget = method === "phone" ? resolvePhoneTarget() : null;

      if (method === "phone" && !phoneTarget) {
        setError("Please enter a valid phone number.");
        return;
      }
      if (method === "email" && !isValidEmail(email)) {
        setError("Please enter a valid email address.");
        return;
      }

      const target = method === "phone" ? phoneTarget! : email.trim();

      setIsSubmitting(true);
      setError(null);
      setNotice(null);

      try {
        const form = new FormData();
        if (method === "phone") form.set("phone", target);
        else form.set("email", target);
        await signIn(method === "phone" ? "phone-otp" : "email-otp", form);

        if (method === "phone") {
          // Remember where the code went, then clear the editable input.
          setVerificationPhone(target);
          setPhone("");
        }
        setStage("verify");
        setCode("");
        setResendIn(RESEND_SECONDS);
        verifyingRef.current = false;
        setNotice(
          isResend
            ? `We sent a new code to ${target}.`
            : `We sent a 6-digit code to ${target}.`,
        );
      } catch (error) {
        setError(friendlyError(error, "send", method));
      } finally {
        setIsSubmitting(false);
      }
    },
    // resolvePhoneTarget is derived from state captured below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [email, isSubmitting, method, phone, signIn, stage, verificationPhone],
  );

  const handleIdentifierSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendCode(false);
  };

  const verifyCode = useCallback(
    async (submitted: string) => {
      if (isSubmitting || verifyingRef.current) return;
      if (submitted.length !== OTP_LENGTH) return;

      verifyingRef.current = true;
      setIsSubmitting(true);
      setError(null);

      // Verification always targets the number the code was sent to, never the
      // (now cleared) editable input.
      const target =
        method === "phone"
          ? verificationPhone || `+91${toTenDigits(phone)}`
          : email.trim();

      try {
        const form = new FormData();
        form.set("code", submitted);
        if (method === "phone") form.set("phone", target);
        else form.set("email", target);
        await signIn(method === "phone" ? "phone-otp" : "email-otp", form);
        // The auth effect performs the redirect once the session is confirmed,
        // which keeps the returnTo destination intact.
      } catch (error) {
        setError(friendlyError(error, "verify", method));
        setCode("");
        verifyingRef.current = false;
        // Let the boxes re-render empty after a wrong code.
        requestAnimationFrame(() => {
          const first = document.querySelector<HTMLInputElement>(
            '[data-otp-input="0"]',
          );
          first?.focus();
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, isSubmitting, method, phone, signIn, verificationPhone],
  );

  const handleVerifySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void verifyCode(code);
  };

  const canResend = resendIn === 0 && !isSubmitting;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#04140E] text-emerald-50">
      {/* Ambient atmosphere — restrained radial glows, no stacked cards. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 50% 0%, rgba(16,185,129,0.20) 0%, transparent 70%), radial-gradient(50% 45% at 85% 100%, rgba(5,150,105,0.14) 0%, transparent 70%), linear-gradient(180deg, #04140E 0%, #062018 100%)",
        }}
      />

      {/* Branding bar */}
      <header className="relative z-10 px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500 font-bold text-sm tracking-tight text-white shadow-sm">
            KC
          </div>
          <div className="leading-tight">
            <span className="text-lg font-bold tracking-tight text-emerald-50">
              Kalyan Chemist
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-200/60">
              Health, Redefined
            </span>
          </div>
        </div>
      </header>

      {/* Single centred card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 pt-4">
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10">
                <ShieldCheck className="size-6 text-emerald-300" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-emerald-50 sm:text-[28px]">
                Welcome back
              </h1>
              <p className="mt-1.5 text-sm text-emerald-100/65">
                Sign in to manage your orders &amp; health
              </p>
            </div>

            {/* Method switcher */}
            <div className="mt-6">
              <SegmentedToggle
                label="Sign-in method"
                value={method}
                onChange={switchMethod}
                disabled={isSubmitting}
                options={[
                  {
                    value: "email",
                    label: "Email",
                    icon: <Mail className="size-4" aria-hidden="true" />,
                  },
                  {
                    value: "phone",
                    label: "Phone",
                    icon: <Phone className="size-4" aria-hidden="true" />,
                  },
                ]}
              />
            </div>

            {notice && !error && (
              <p
                role="status"
                className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span>{notice}</span>
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-100"
              >
                {error}
              </p>
            )}

            {/* ── Identifier step ── */}
            {stage === "identifier" && (
              <form onSubmit={handleIdentifierSubmit} noValidate className="mt-5 space-y-4">
                {method === "phone" ? (
                  <div className="space-y-2">
                    <label
                      htmlFor="login-phone"
                      className="block text-xs font-semibold uppercase tracking-wider text-emerald-100/70"
                    >
                      Phone Number
                    </label>
                    <div className="flex items-stretch overflow-hidden rounded-lg border border-white/12 bg-white/[0.04] transition-colors focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/30">
                      <span className="flex items-center border-r border-white/10 px-3.5 text-sm font-medium text-emerald-100/70">
                        +91
                      </span>
                      <input
                        id="login-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        pattern="[0-9]*"
                        disabled={isSubmitting}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="98765 43210"
                        aria-invalid={error ? true : undefined}
                        className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm text-emerald-50 placeholder:text-emerald-200/35 focus:outline-none disabled:opacity-60"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold uppercase tracking-wider text-emerald-100/70"
                    >
                      Email Address
                    </label>
                    <Input
                      id="login-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      disabled={isSubmitting}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-invalid={error ? true : undefined}
                      className="border-white/12 bg-white/[0.04] py-3 text-emerald-50 placeholder:text-emerald-200/35 focus-visible:border-emerald-400/60 focus-visible:ring-emerald-400/30"
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-lg bg-emerald-500 font-semibold text-white transition-colors hover:bg-emerald-400 focus-visible:ring-emerald-300 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                      Sending…
                    </>
                  ) : method === "phone" ? (
                    "Send OTP"
                  ) : (
                    "Send Code"
                  )}
                </Button>
              </form>
            )}

            {/* ── Code step ── */}
            {stage === "verify" && (
              <form onSubmit={handleVerifySubmit} noValidate className="mt-5 space-y-5">
                <div className="space-y-1.5 text-center">
                  <p
                    id="otp-heading"
                    className="block text-xs font-semibold uppercase tracking-wider text-emerald-100/70"
                  >
                    {method === "phone" ? "Enter OTP" : "Enter verification code"}
                  </p>
                  <p className="text-sm text-emerald-100/60">
                    Sent to <span className="font-medium text-emerald-100">{maskedTarget}</span>
                  </p>
                </div>

                <OtpInput
                  value={code}
                  onChange={setCode}
                  onComplete={(submitted) => void verifyCode(submitted)}
                  length={OTP_LENGTH}
                  disabled={isSubmitting}
                  invalid={Boolean(error)}
                  labelledBy="otp-heading"
                  label={method === "phone" ? "OTP" : "Verification code"}
                />

                <Button
                  type="submit"
                  disabled={isSubmitting || code.length !== OTP_LENGTH}
                  className="h-12 w-full rounded-lg bg-emerald-500 font-semibold text-white transition-colors hover:bg-emerald-400 focus-visible:ring-emerald-300 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                      Verifying…
                    </>
                  ) : (
                    "Verify & Continue"
                  )}
                </Button>

                <div className="flex flex-col items-center gap-1.5 text-sm">
                  <button
                    type="button"
                    onClick={() => void sendCode(true)}
                    disabled={!canResend}
                    className="rounded font-medium text-emerald-300 transition-colors hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 disabled:cursor-not-allowed disabled:text-emerald-200/40 disabled:hover:text-emerald-200/40"
                  >
                    {resendIn > 0
                      ? `Resend ${method === "phone" ? "OTP" : "code"} in ${resendIn}s`
                      : `Resend ${method === "phone" ? "OTP" : "code"}`}
                  </button>
                  <button
                    type="button"
                    onClick={resetToIdentifier}
                    className="inline-flex items-center gap-1.5 rounded font-medium text-emerald-100/60 transition-colors hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
                  >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    {method === "phone" ? "Change Phone Number" : "Change Email"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Reassurance strip — outside the card to avoid nesting clutter. */}
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-medium leading-relaxed text-white">
            <Lock className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
            <span>No passwords needed — we verify every sign-in with a one-time code.</span>
          </p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-normal leading-relaxed text-white/80">
            <Sparkles className="size-3 shrink-0 text-emerald-300" aria-hidden="true" />
            <span>New here? A code creates your account automatically.</span>
          </p>
        </div>
      </main>
    </div>
  );
}

export default Auth;
