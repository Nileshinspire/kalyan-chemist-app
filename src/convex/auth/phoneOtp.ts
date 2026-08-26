import { Phone } from "@convex-dev/auth/providers/Phone";
import { api } from "../_generated/api";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * Phone OTP provider using Twilio SMS.
 *
 * The freebuff auth service (auth.freebuff.app/send_otp) only supports
 * email OTP, so phone OTP is routed through the existing Twilio-based
 * smsService.sendGenericSms action.
 *
 * Required environment variables (set in Convex dashboard → Settings → Environment):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER  (E.164 format, e.g. +1XXXXXXXXXX)
 */
export const phoneOtp = Phone({
  // Normalize phone to E.164 format (+91XXXXXXXXXX)
  normalizeIdentifier(identifier: string) {
    const digits = identifier.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    if (identifier.startsWith("+")) return identifier;
    return `+91${digits}`;
  },
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest(
    { identifier: phone, token }: { identifier: string; token: string },
    ctx?: any,
  ) {
    const message =
      `Your Kalyan Chemist verification code is: ${token}. ` +
      `Valid for 20 minutes. Do not share this code with anyone.`;

    // Route through the existing Twilio-based smsService
    if (ctx?.runAction) {
      try {
        const result = await ctx.runAction(
          api.smsService.sendGenericSms,
          { toPhone: phone, message },
        );
        if (result?.sent) return;
        // Twilio not configured — fall through to error below
        throw new Error(
          result?.reason === "no_twilio_config"
            ? "SMS not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your Convex deployment environment."
            : result?.reason === "invalid_phone"
              ? "Invalid phone number. Please check and try again."
              : "SMS delivery failed. Please try again.",
        );
      } catch (error: any) {
        // Re-throw our own meaningful errors
        if (
          error?.message?.includes("TWILIO") ||
          error?.message?.includes("SMS not configured") ||
          error?.message?.includes("Invalid phone") ||
          error?.message?.includes("SMS delivery failed")
        ) {
          throw error;
        }
        throw new Error(
          `Failed to send SMS verification code. ${error?.message || "Please try again."}`,
        );
      }
    }

    // Fallback: should not reach here in normal operation
    throw new Error(
      "SMS service is not available. Please use email to sign in.",
    );
  },
});
