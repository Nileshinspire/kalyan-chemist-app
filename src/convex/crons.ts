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
  { minutes: 1 },
  internal.messageDispatch.dispatchScheduled,
  {}
);

crons.interval(
  "message center stuck run recovery",
  { minutes: 10 },
  internal.messageDispatch.resumeStuck,
  {}
);

export default crons;
