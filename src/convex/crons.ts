import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Message Center scheduling safety net.
 *
 * Exact-time sends are also scheduled with `ctx.scheduler.runAt` when a campaign
 * is saved. This cron is the durable fallback (e.g. after a deployment) and the
 * recovery path for batches interrupted mid-run. All work is idempotent.
 */
const crons = cronJobs();

crons.interval(
  "message center scheduled dispatch",
  { minutes: 5 },
  internal.messageDispatch.dispatchScheduled,
  {}
);

crons.interval(
  "message center stuck run recovery",
  { minutes: 10 },
  internal.messageDispatch.resumeStuck,
  {}
);

// ── Pill Reminder due-dose notifications ──
// Runs every 15 minutes and is idempotent: each scheduled dose is notified at
// most once (guarded by `lastNotifiedSlot` and the recorded-dose history).
crons.interval(
  "pill reminder due doses",
  { minutes: 15 },
  internal.pillReminders.processDue,
  {}
);

// ── Live delivery tracking safety net ──
// A crashed browser or lost phone stops sending GPS pings; after a few minutes
// the session is closed and its coordinates are erased.
crons.interval(
  "expire stale delivery tracking",
  { minutes: 5 },
  internal.deliveryTracking.expireStale,
  {},
);

// ── Proactive refill suggestions ──
// Only customer-confirmed suggestions with a due `nextReminderAt` notify, and
// a manual refill reminder always wins (no duplicate reminders).
crons.interval(
  "proactive refill suggestions",
  { minutes: 30 },
  internal.refillSuggestions.processDue,
  {}
);

export default crons;
