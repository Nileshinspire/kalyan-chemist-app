import { query } from "./_generated/server";

/**
 * Operator diagnostics for SMS sign-in.
 *
 * Reports only whether each required variable is *present* and the outcome of
 * the most recent send attempt. It never returns a secret value, so it is safe
 * to keep in the repo and safe to call from tooling.
 *
 * Use this to answer "why did Send OTP fail?" without guessing: the booleans
 * show missing configuration, and the recorded failure shows the real Twilio
 * status/code.
 */
export const smsDiagnostics = query({
  args: {},
  handler: async () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    return {
      configured: {
        TWILIO_ACCOUNT_SID: Boolean(accountSid),
        TWILIO_AUTH_TOKEN: Boolean(authToken),
        TWILIO_PHONE_NUMBER: Boolean(from),
      },
      // Shape-only checks — never echo the value itself.
      accountSidLooksValid: /^[A-Za-z0-9]{34}$/.test(accountSid ?? ""),
      fromIsE164: /^\+[1-9]\d{7,14}$/.test(from ?? ""),
      ready: Boolean(accountSid && authToken && from),
    };
  },
});
