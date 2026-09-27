import { query } from "./_generated/server";

/**
 * Reports whether real SMS delivery is configured for phone sign-in.
 *
 * The login page uses this to decide whether to offer the "Phone" method.
 * When Twilio credentials are missing we hide phone sign-in rather than
 * pretending an SMS was sent — the email OTP method always stays available.
 *
 * Returns a boolean only; no secret values ever leave the server.
 */
export const phoneOtpAvailable = query({
  args: {},
  handler: async () => {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER,
    );
  },
});
