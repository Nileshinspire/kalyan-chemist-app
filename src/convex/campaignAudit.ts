/**
 * Campaign audit trail.
 *
 * Records who did what and when. It stores no message bodies, recipient
 * contact details or credentials — only an admin, an action, a campaign name
 * and a short sanitised detail string. Access is admin-only at the query layer.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { isAdminRole } from "./messageCenterCore";

export interface AuditEntry {
  campaignId?: any;
  campaignTitle?: string;
  action: string;
  actorId: any;
  actorName?: string | null;
  detail?: string;
}

/** Write an audit row from any admin mutation. Never throws to the caller. */
export async function recordAudit(ctx: any, entry: AuditEntry): Promise<void> {
  try {
    await ctx.db.insert("campaign_audit_log", {
      campaignId: entry.campaignId,
      campaignTitle: entry.campaignTitle?.slice(0, 160),
      action: entry.action.slice(0, 60),
      actorId: entry.actorId,
      actorName: entry.actorName?.slice(0, 120),
      detail: entry.detail?.slice(0, 300),
      createdAt: Date.now(),
    });
  } catch {
    // Auditing must never block the operation the admin asked for.
  }
}

/** Used by actions (test send) that cannot write to the database directly. */
export const record = internalMutation({
  args: {
    campaignId: v.optional(v.id("message_campaigns")),
    campaignTitle: v.optional(v.string()),
    action: v.string(),
    actorId: v.id("users"),
    actorName: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor: any = await ctx.db.get(args.actorId);
    if (!actor || !isAdminRole(actor.role)) {
      throw new Error("Unauthorized: admin only");
    }
    await recordAudit(ctx, args);
    return { success: true };
  },
});
