import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, Phone } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

/** Detect if input is an email address */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Detect if input is a valid Indian phone number */
function isPhone(value: string): boolean {
  const cleaned = value.replace(/[\s\-()+]/g, "");
  return /^[6-9]\d{9}$/.test(cleaned);
}

/** Normalize phone number to 10 digits */
function normalizePhone(value: string): string {
  return value.replace(/[\s\-()+]/g, "").slice(-10);
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { identifier: string; method: "email" | "phone" }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleIdentifierSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const rawInput = (formData.get("identifier") as string)?.trim() || "";

    if (!rawInput) {
      setError("Please enter your email address or phone number.");
      setIsLoading(false);
      return;
    }

    if (isEmail(rawInput)) {
      // Email OTP flow — server expects 'email' param, not 'identifier'
      try {
        const emailFormData = new FormData();
        emailFormData.set("email", rawInput.trim());
        await signIn("email-otp", emailFormData);
        setStep({ identifier: rawInput.trim(), method: "email" });
        setIsLoading(false);
      } catch (error) {
        console.error("Email sign-in error:", error);
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("Connection lost")) {
          setError("Connection issue. Please check your internet and try again.");
        } else if (msg.includes("rate limit")) {
          setError("Too many attempts. Please wait a moment and try again.");
        } else {
          setError(
            msg || "We could not send a verification code. Please try again.",
          );
        }
        setIsLoading(false);
      }
    } else if (isPhone(rawInput)) {
      // Phone OTP flow
      const phone = normalizePhone(rawInput);
      try {
        // Create a new FormData with the phone field for phone-otp provider
        const phoneFormData = new FormData();
        phoneFormData.set("phone", `+91${phone}`);
        await signIn("phone", phoneFormData);
        setStep({ identifier: phone, method: "phone" });
        setIsLoading(false);
      } catch (error) {
        console.error("Phone sign-in error:", error);
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("Connection lost")) {
          setError("Connection issue. Please check your internet and try again.");
        } else if (msg.includes("rate limit")) {
          setError("Too many attempts. Please wait a moment and try again.");
        } else if (msg.includes("not configured") || msg.includes("provider")) {
          setError(
            "Phone verification is not yet configured. Please use your email address to sign in.",
          );
        } else {
          setError(
            msg || "We could not send a verification code. Please try again.",
          );
        }
        setIsLoading(false);
      }
    } else {
      setError(
        "Please enter a valid email address (e.g. you@example.com) or 10-digit phone number (e.g. 9876543210).",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const provider = typeof step === "object" && step.method === "email" ? "email-otp" : "phone";
      await signIn(provider, formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("Connection lost")) {
        setError("Connection issue. Please check your internet and try again.");
      } else if (msg.includes("expired")) {
        setError("The verification code has expired. Please request a new one.");
      } else {
        setError("The verification code is incorrect. Please check and try again.");
      }
      setIsLoading(false);
      setOtp("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary/[0.03] to-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm tracking-tight">
              KC
            </div>
            <div className="leading-tight">
              <span className="text-lg font-bold tracking-tight text-foreground">
                Kalyan Chemist
              </span>
              <span className="hidden sm:block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Trusted Pharmacy
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="flex items-center justify-center h-full flex-col">
          <Card className="min-w-[360px] max-w-[400px] border-border/70 shadow-lg">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl font-bold">
                    Welcome to Kalyan Chemist
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Enter your email or phone number to sign in or create a new account.
                    We will send you a verification code.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleIdentifierSubmit}>
                  <CardContent>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="identifier"
                          placeholder="Email or phone number"
                          type="text"
                          inputMode="text"
                          autoComplete="username"
                          className="pl-9"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-destructive">{error}</p>
                    )}
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="text-xl font-bold">
                    {step.method === "email" ? "Check Your Inbox" : "Check Your Phone"}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {step.method === "email" ? (
                      <>
                        We sent a verification code to{" "}
                        <span className="font-medium text-foreground">{step.identifier}</span>
                      </>
                    ) : (
                      <>
                        We sent an OTP to{" "}
                        <span className="font-medium text-foreground">+91 {step.identifier}</span>
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="space-y-4">
                    <input type="hidden" name="code" value={otp} />
                    <input
                      type="hidden"
                      name={step.method === "email" ? "email" : "phone"}
                      value={step.method === "email" ? step.identifier : `+91${step.identifier}`}
                    />
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                        disabled={isLoading}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPGroup>
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="text-sm text-destructive text-center">{error}</p>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3">
                    <Button
                      type="submit"
                      className="w-full gradient-primary text-white"
                      disabled={isLoading || otp.length < 6}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Verify Code
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStep("signIn");
                        setOtp("");
                        setError(null);
                      }}
                    >
                      Use a different method
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function AuthPage() {
  return (
    <Suspense>
      <Auth />
    </Suspense>
  );
}

export default AuthPage;
