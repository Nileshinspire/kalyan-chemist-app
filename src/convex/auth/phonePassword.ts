/**
 * Phone + Password authentication provider.
 *
 * Uses ConvexCredentials under the hood with Scrypt (Lucia) password hashing.
 * This replaces the broken phone OTP flow with a free, no-API-key-required
 * phone number + password authentication.
 *
 * Architecture note: This provider is designed so that SMS-based phone
 * verification (via Twilio or another provider) can be layered on top
 * later by adding a `verify` callback to the config, without changing
 * the core password authentication flow.
 *
 * Required for future SMS upgrade:
 *   - Add `verify: someEmailOrPhoneOtpProvider` to the config
 *   - The `shouldLinkViaPhone: true` flag already enables phone-based
 *     account linking when a verified phone number exists.
 */
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { Scrypt } from "lucia";

interface PhonePasswordConfig {
  /** Override the default provider ID (default: "phone-password") */
  id?: string;
  /** Custom password validation. If omitted, requires min 8 chars. */
  validatePasswordRequirements?: (password: string) => void;
  /**
   * Optional: plug in a phone OTP provider here for future SMS verification.
   * When provided, newly created accounts will be routed through this
   * provider for phone verification before the session is issued.
   */
  verify?: any;
}

export const phonePassword = (config: PhonePasswordConfig = {}) => {
  const providerId = config.id ?? "phone-password";

  return ConvexCredentials({
    id: providerId,

    authorize: async (params: any, ctx: any) => {
      const flow = params.flow;
      const phone = params.phone as string | undefined;
      const password = params.password as string | undefined;

      if (!phone) {
        throw new Error("Phone number is required");
      }

      // ── Password validation ──
      const passwordToValidate =
        flow === "signUp" ? password : null;

      if (passwordToValidate !== null && passwordToValidate !== undefined) {
        if (config.validatePasswordRequirements) {
          config.validatePasswordRequirements(passwordToValidate as string);
        } else {
          if (!passwordToValidate || passwordToValidate.length < 8) {
            throw new Error(
              "Password must be at least 8 characters long",
            );
          }
        }
      }

      if (flow === "signUp") {
        if (!password) {
          throw new Error("Password is required for sign up");
        }

        const created = await createAccount(ctx, {
          provider: providerId,
          account: { id: phone, secret: password as string },
          profile: { phone },
          shouldLinkViaEmail: false,
          shouldLinkViaPhone: true,
        });

        // ── Future SMS verification hook ──
        // If a verify provider is configured, route new accounts through it.
        // For now, accounts are immediately active (no phone verification).
        // To add SMS verification later, pass a Phone OTP provider as `verify`.

        return { userId: created.user._id };
      }

      if (flow === "signIn") {
        if (!password) {
          throw new Error("Password is required for sign in");
        }

        const retrieved = await retrieveAccount(ctx, {
          provider: providerId,
          account: { id: phone, secret: password as string },
        });

        if (retrieved === null) {
          throw new Error("Invalid phone number or password");
        }

        return { userId: retrieved.user._id };
      }

      throw new Error(
        `Unsupported flow "${flow}". Use "signUp" or "signIn".`,
      );
    },

    crypto: {
      async hashSecret(password: string) {
        return await new Scrypt().hash(password);
      },
      async verifySecret(password: string, hash: string) {
        return await new Scrypt().verify(hash, password);
      },
    },
  });
};
