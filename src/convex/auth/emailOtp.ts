import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    // Resolved before the request so a missing key keeps its own message
    // instead of being reported as a transport failure.
    const headers = freebuffEmailOtpHeaders();
    // fetch has no `timeout` option; this is the 15s limit it replaced.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let status: number;
    try {
      const response = await fetch(freebuffEmailOtpUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ to: email, otp: token }),
        signal: controller.signal,
      });
      status = response.status;
      // Release the connection. The body is read only to drain it: it can echo
      // the request we sent, so it never reaches a message or a log.
      await response.text().catch(() => "");
    } catch (error: unknown) {
      // The Convex runtime has no Node network stack, so the only failures that
      // land here are our own abort and an unreachable host.
      const name = (error as { name?: string })?.name;
      if (name === "AbortError" || name === "TimeoutError") {
        throw new Error("Email service timed out. Please try again in a moment.");
      }
      throw new Error("Email service is temporarily unavailable. Please try again.");
    } finally {
      clearTimeout(timer);
    }

    // Gateway rejections: friendly copy only, never the response body.
    if (status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    if (status >= 500) {
      throw new Error("Email service error. Please try again.");
    }
    if (status >= 400) {
      throw new Error("Failed to send verification code. Please try again.");
    }
  },
});

// Sign-in codes are sent by the Freebuff integrations gateway, which knows
// this project by its own key: VLY_INTEGRATION_KEY, a Convex environment
// variable set when the project was created. The email's wording is fixed by
// the gateway.
function freebuffEmailOtpUrl(): string {
  const base =
    process.env.VLY_INTEGRATION_BASE_URL || "https://integrations.vly.ai";
  return `${base.replace(/\/+$/, "")}/v1/email/otp`;
}

function freebuffEmailOtpHeaders(): Record<string, string> {
  const key = process.env.VLY_INTEGRATION_KEY;
  if (!key) {
    throw new Error(
      "VLY_INTEGRATION_KEY is not set on this Convex deployment, so email sign-in cannot send codes.",
    );
  }
  return { Authorization: `Bearer ${key}` };
}

// Never stringify the whole request error: it carries the request headers.
function freebuffEmailOtpError(error: unknown): Error {
  const response = (
    error as { response?: { status?: number; data?: { error?: unknown } } }
  )?.response;
  if (response) {
    const detail =
      typeof response.data?.error === "string" ? `: ${response.data.error}` : "";
    return new Error(
      `Could not send the sign-in code (HTTP ${response.status})${detail}`,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Could not send the sign-in code: ${message}`);
}
