import { Phone } from "@convex-dev/auth/providers/Phone";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const phoneOtp = Phone({
  id: "phone-otp",
  maxAge: 60 * 15, // 15 minutes
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
  async sendVerificationRequest({ identifier: phone, token }) {
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: phone,
          otp: token,
          appName: process.env.VLY_APP_NAME || "Kalyan Chemist",
          channel: "sms",
        },
        {
          headers: {
            "x-api-key": "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
          },
          timeout: 15000,
        },
      );
    } catch (error: any) {
      if (error?.code === "ECONNABORTED" || error?.message?.includes("timeout")) {
        throw new Error("SMS service timed out. Please try again in a moment.");
      }
      if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
        throw new Error("SMS service is temporarily unavailable. Please try again.");
      }
      const status = error?.response?.status;
      if (status === 429) {
        throw new Error("Too many requests. Please wait a moment and try again.");
      }
      if (status && status >= 500) {
        throw new Error("SMS service error. Please try again.");
      }
      throw new Error("Failed to send verification code. Please try again.");
    }
  },
});
