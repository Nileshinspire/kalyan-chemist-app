import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
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
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        },
        {
          headers: {
            "x-api-key": "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
          },
          timeout: 15000, // 15s timeout — prevents hung connections
        },
      );
    } catch (error: any) {
      // Provide clear, actionable error messages instead of raw JSON
      if (error?.code === "ECONNABORTED" || error?.message?.includes("timeout")) {
        throw new Error("Email service timed out. Please try again in a moment.");
      }
      if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
        throw new Error("Email service is temporarily unavailable. Please try again.");
      }
      const status = error?.response?.status;
      if (status === 429) {
        throw new Error("Too many requests. Please wait a moment and try again.");
      }
      if (status && status >= 500) {
        throw new Error("Email service error. Please try again.");
      }
      throw new Error("Failed to send verification code. Please try again.");
    }
  },
});
