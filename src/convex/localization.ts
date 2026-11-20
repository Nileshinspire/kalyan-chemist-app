import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { INTERFACE_KEYS, SUPPORTED_LANGUAGES, isLanguageCode } from "../lib/i18n";

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");
  return userId;
}

async function languageRows(ctx: any) {
  const rows = await ctx.db.query("app_languages").collect();
  if (rows.length === 0) {
    return SUPPORTED_LANGUAGES.map((lang, index) => ({
      code: lang.code,
      label: lang.label,
      nativeLabel: lang.nativeLabel,
      isActive: true,
      sortOrder: index,
    }));
  }
  return rows.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
}

/** Languages the storefront may offer. Public, no customer data. */
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const rows = await languageRows(ctx);
    return {
      languages: rows.map((row: any) => ({
        code: row.code,
        label: row.label,
        nativeLabel: row.nativeLabel,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })),
    };
  },
});

/** Signed-in customer's saved language. */
export const getMyLanguage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    return isLanguageCode(user?.language ?? null) ? user?.language : "en";
  },
});

/** Save a language only if it is currently enabled. */
export const setMyLanguage = mutation({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!isLanguageCode(args.language)) {
      throw new Error("Choose English, Hindi or Marathi.");
    }
    const rows = await languageRows(ctx);
    const match = rows.find((row: any) => row.code === args.language);
    if (!match || !match.isActive) {
      throw new Error("This language is not currently available.");
    }
    await ctx.db.patch(userId, { language: args.language });
    return { success: true, language: args.language };
  },
});

/** Reviewed translation overrides for one language. */
export const getDictionary = query({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    if (!isLanguageCode(args.language)) return {};
    const rows = await ctx.db
      .query("app_translations")
      .withIndex("by_language_key", (q) => q.eq("languageCode", args.language))
      .collect();
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  },
});

// ── Admin ──

export const adminGetSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await languageRows(ctx);
    const translations = await ctx.db.query("app_translations").collect();

    return {
      languages: rows.map((row: any) => {
        const overrides = translations.filter((t) => t.languageCode === row.code);
        return {
          code: row.code,
          label: row.label,
          nativeLabel: row.nativeLabel,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
          overrideCount: overrides.length,
          missingCount:
            row.code === "en"
              ? 0
              : INTERFACE_KEYS.filter(
                  (key) => !overrides.some((t) => t.key === key),
                ).length,
        };
      }),
      totalInterfaceKeys: INTERFACE_KEYS.length,
    };
  },
});

export const adminUpdateLanguages = mutation({
  args: {
    languages: v.array(
      v.object({
        code: v.string(),
        label: v.string(),
        nativeLabel: v.string(),
        isActive: v.boolean(),
        sortOrder: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (args.languages.length !== SUPPORTED_LANGUAGES.length) {
      throw new Error("Keep exactly the three supported languages.");
    }
    const codes = new Set<string>();
    for (const lang of args.languages) {
      if (!isLanguageCode(lang.code)) throw new Error("Unsupported language code.");
      if (codes.has(lang.code)) throw new Error("Duplicate language.");
      codes.add(lang.code);
      if (lang.label.trim().length < 2 || lang.nativeLabel.trim().length < 2) {
        throw new Error("Language labels are required.");
      }
      if (lang.code === "en" && !lang.isActive) {
        throw new Error("English must stay enabled as the fallback language.");
      }
    }

    const existing = await ctx.db.query("app_languages").collect();
    const now = Date.now();
    for (const lang of args.languages) {
      const row = existing.find((r) => r.code === lang.code);
      const values = {
        code: lang.code,
        label: lang.label.trim(),
        nativeLabel: lang.nativeLabel.trim(),
        isActive: lang.isActive,
        sortOrder: Math.round(lang.sortOrder) || 0,
        updatedAt: now,
        updatedBy: adminId,
      };
      if (row) await ctx.db.patch(row._id, values);
      else await ctx.db.insert("app_languages", values);
    }
    return { success: true };
  },
});

export const adminListTranslations = query({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!isLanguageCode(args.language)) return [];
    return await ctx.db
      .query("app_translations")
      .withIndex("by_language_key", (q) => q.eq("languageCode", args.language))
      .collect();
  },
});

export const adminUpsertTranslation = mutation({
  args: {
    language: v.string(),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!isLanguageCode(args.language) || args.language === "en") {
      throw new Error("English is the source language and cannot be overridden.");
    }
    const key = args.key.trim();
    const value = args.value.trim();
    if (!/^[a-zA-Z0-9_.-]{2,80}$/.test(key)) {
      throw new Error("Use a valid interface key.");
    }
    if (value.length < 1 || value.length > 500) {
      throw new Error("Translation must be between 1 and 500 characters.");
    }
    const existing = await ctx.db
      .query("app_translations")
      .withIndex("by_language_key", (q) =>
        q.eq("languageCode", args.language).eq("key", key),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
      return { success: true, updated: true };
    }
    await ctx.db.insert("app_translations", {
      languageCode: args.language,
      key,
      value,
      updatedAt: Date.now(),
    });
    return { success: true, updated: false };
  },
});

export const adminDeleteTranslation = mutation({
  args: { translationId: v.id("app_translations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.translationId);
    if (!row) throw new Error("Translation not found.");
    await ctx.db.delete(row._id);
    return { success: true };
  },
});

/** Aggregate language usage only — no customer identities. */
export const adminUsage = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const counts: Record<string, number> = { en: 0, hi: 0, mr: 0 };
    for (const user of users) {
      const code = isLanguageCode(user.language ?? null) ? user.language! : "en";
      counts[code] = (counts[code] ?? 0) + 1;
    }
    return {
      totalUsers: users.length,
      counts,
    };
  },
});
