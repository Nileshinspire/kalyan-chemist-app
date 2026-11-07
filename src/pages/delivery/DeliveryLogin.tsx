import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AlertCircle, ArrowLeft, Loader2, Lock, Phone, Truck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { normalizePhone } from "@/convex/deliveryTrackingCore";

export default function DeliveryLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signOut, isAuthenticated, isAuthLoading, user } = useAuth();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnToParam = searchParams.get("returnTo");
  const returnTo =
    returnToParam && returnToParam.startsWith("/delivery") ? returnToParam : "/delivery";

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAuthenticated && user?.role === "delivery") {
      navigate(returnTo, { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, user, navigate, returnTo]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const normalized = normalizePhone(phone);
    if (normalized.length < 10) {
      setError("Enter the phone number registered by the pharmacy.");
      return;
    }
    if (password.length < 8) {
      setError("Enter your password (at least 8 characters).");
      return;
    }

    setSubmitting(true);
    try {
      await signIn("phone-password", {
        phone: normalized,
        password,
        flow: "signIn",
      });
    } catch (err: any) {
      setError(
        /invalid|not found|password/i.test(err?.message ?? "")
          ? "Incorrect phone number or password."
          : err?.message ?? "Could not sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const wrongAccount = isAuthenticated && user && user.role !== "delivery";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#04140E] px-4 py-10 text-emerald-50">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(70%_60%_at_20%_0%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(60%_50%_at_100%_100%,rgba(5,150,105,0.2),transparent_60%)]" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur md:grid-cols-[1.05fr_1fr]">
        <div className="hidden flex-col justify-between border-r border-white/10 p-9 md:flex">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                <Truck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide">Kalyan Chemist</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/70">
                  Delivery Partners
                </p>
              </div>
            </div>

            <h1 className="mt-10 text-3xl font-semibold leading-tight">
              Deliver medicines.
              <br />
              Share the ride, not your privacy.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-emerald-100/60">
              Sign in to see only the orders assigned to you. Location sharing starts
              when you tap Start Delivery and stops the moment the delivery is complete.
            </p>
          </div>

          <ul className="space-y-2.5 text-xs text-emerald-100/60">
            <li>• Only your assigned deliveries are visible.</li>
            <li>• GPS runs only during an active delivery.</li>
            <li>• You can stop sharing at any time.</li>
          </ul>
        </div>

        <div className="p-7 sm:p-9">
          <Link
            to="/"
            className="mb-7 inline-flex items-center gap-1.5 text-xs text-emerald-100/60 transition-colors hover:text-emerald-100"
          >
            <ArrowLeft className="size-3.5" /> Back to store
          </Link>

          <div className="mb-6 flex items-center gap-2 md:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <Truck className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Kalyan Chemist</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">
                Delivery Partner
              </p>
            </div>
          </div>

          <h2 className="text-xl font-semibold">Delivery partner sign in</h2>
          <p className="mt-1 text-sm text-emerald-100/60">
            Use the phone number and password created by the pharmacy admin.
          </p>

          {wrongAccount ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <p className="text-xs leading-relaxed text-amber-100/90">
                  You are signed in as a different account. Sign out to use a delivery
                  partner login.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  setPhone("");
                  setPassword("");
                  setError(null);
                }}
                className="w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
              >
                Sign out of this account
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="delivery-phone" className="mb-1.5 block text-xs font-medium text-emerald-100/80">
                  Phone number
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
                  <Phone className="size-4 text-emerald-300/70" />
                  <input
                    id="delivery-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Phone number"
                    className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-emerald-100/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="delivery-password" className="mb-1.5 block text-xs font-medium text-emerald-100/80">
                  Password
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
                  <Lock className="size-4 text-emerald-300/70" />
                  <input
                    id="delivery-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-emerald-100/30"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-100">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || isAuthLoading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {submitting ? "Signing in…" : "Sign in to deliver"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-emerald-100/40">
            Accounts are created by the pharmacy administrator. If you need access,
            contact the store.
          </p>
        </div>
      </div>
    </div>
  );
}
