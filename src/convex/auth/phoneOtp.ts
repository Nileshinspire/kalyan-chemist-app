import { Phone } from "@convex-dev/auth/providers/Phone";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { normalizeIndianPhone } from "../../lib/phone";

/**
 * Phone OTP provider — real SMS sign-in via Twilio Verify-style REST call.
 *
 * Why `fetch` and not the existing `smsService.sendGenericSms` action:
 * Convex Auth invokes `sendVerificationRequest` from inside the `auth:store`
 * *mutation*, and a mutation context cannot `runAction`. Routing through a
 * public HTTP relay would let anyone send arbitrary SMS on our account, so we
 * call Twilio's REST API directly instead. Twilio's message endpoint is plain
 * HTTPS + Basic auth, which works fine in the Convex runtime (no Node-only
 * APIs), so this stays server-side and the SMS credentials never reach the
 * client.
 *
 * The token below is generated per request and stored only as a SHA-256 hash
 * by Convex Auth, so it is never persisted or returned in plaintext.
 *
 * Required environment variables (Convex dashboard → Settings → Environment,
 * or the project's Keys panel):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER   (E.164, the sending number, e.g. +1XXXXXXXXXX)
 *
 * When these are absent the send fails loudly with a clean message and the
 * login page tells the customer to use email. We never fake a successful send.
 */
export const phoneOtp = Phone({
  id: "phone-otp",
  // 15 minutes, matching the email OTP window.
  maxAge: 60 * 15,
  // Indian numbers: 9876543210 / 09876543210 / 919876543210 / +919876543210.
  normalizeIdentifier(identifier: string) {
    return normalizeIndianPhone(identifier) ?? identifier.trim();
  },
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 6);
  },
  async sendVerificationRequest({
    identifier: phone,
    token,
  }: {
    identifier: string;
    token: string;
  }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !from) {
      // Surface as a user-safe message; the client maps this to a generic
      // "couldn't send the code" copy so internals are never exposed.
      throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
    }

    const to = normalizeIndianPhone(phone);
    if (!to) {
      throw new Error("SMS_INVALID_PHONE");
    }

    const body = new URLSearchParams({
      To: to,
      From: from,
      Body:
        `${token} is your Kalyan Chemist verification code. ` +
        `It expires in 15 minutes. Do not share it with anyone.`,
    });

    let response: Response;
    try {
      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
    } catch {
      // Network/DNS failure reaching Twilio.
      throw new Error("SMS_SEND_FAILED");
    }

    if (!response.ok) {
      // Log the real status for operators; the customer only ever sees a
      // friendly message because we throw a non-specific code.
      console.error(
        `[phoneOtp] Twilio rejected the message for ${to} — status ${response.status}`,
      );
      throw new Error("SMS_SEND_FAILED");
    }
  },
});
