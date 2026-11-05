// TEMPORARY dev-only harness — remove after E2E verification.
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedOtp = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, { email, code }) => {
    const wanted = email.trim().toLowerCase();
    const accounts = await ctx.db.query("authAccounts").collect();
    const match =
      accounts.find(
        (a: any) =>
          typeof a.providerAccountId === "string" &&
          a.providerAccountId === email.trim(),
      ) ??
      accounts.find(
        (a: any) =>
          typeof a.providerAccountId === "string" &&
          a.providerAccountId.toLowerCase() === wanted,
      );
    if (!match) return { ok: false, reason: "no account" };
    const existing = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", match._id))
      .collect();
    for (const row of existing as any[]) await ctx.db.delete(row._id);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(code),
    );
    const codeHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await ctx.db.insert("authVerificationCodes", {
      accountId: match._id,
      provider: "email-otp",
      code: codeHash,
      expirationTime: Date.now() + 15 * 60 * 1000,
      emailVerified: email.trim(),
    });
    return { ok: true, accountId: match._id };
  },
});
