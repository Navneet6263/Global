import type { VendorJob, VendorJobStatus } from "@/lib/backend-api/vendor-checks";

export type HomeTone = "bad" | "warn" | "info" | "violet" | "neutral";

export interface NextAction {
  job: VendorJob;
  /** Short reason shown on the row, e.g. "Sent back: fix and resubmit". */
  reason: string;
  tone: HomeTone;
  rank: number;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * What needs this vendor login now, most urgent first: work sent back, overdue work, new
 * checks to accept, a member's work for the Team Leader, then work due soon.
 * `myId` is the signed-in user's id; a team member's own TEAM_REVIEW job waits for its
 * Team Leader, so it is not an action for the member.
 */
export function nextActions(
  items: readonly VendorJob[],
  myId: string,
  now = new Date(),
): NextAction[] {
  const actions: NextAction[] = [];
  for (const job of items) {
    const action = actionFor(job, myId, now);
    if (action) actions.push({ job, ...action });
  }
  return actions.sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.job.dueAt ? Date.parse(a.job.dueAt) : Infinity) -
        (b.job.dueAt ? Date.parse(b.job.dueAt) : Infinity),
  );
}

function actionFor(job: VendorJob, myId: string, now: Date): Omit<NextAction, "job"> | null {
  switch (job.status) {
    case "RETURNED":
      return { rank: 0, tone: "bad", reason: "Sent back: fix and resubmit" };
    case "ASSIGNED":
      return { rank: 2, tone: "info", reason: "New: accept or decline" };
    case "TEAM_REVIEW":
      return job.handler?.id === myId
        ? null
        : { rank: 3, tone: "violet", reason: "Review your team member's work" };
    case "IN_PROGRESS": {
      if (job.overdue) return { rank: 1, tone: "bad", reason: "Overdue: submit now" };
      const left = job.dueAt ? Date.parse(job.dueAt) - now.getTime() : Infinity;
      return left <= 2 * DAY
        ? { rank: 4, tone: "warn", reason: "Due soon" }
        : { rank: 5, tone: "neutral", reason: "In progress" };
    }
    default:
      return null;
  }
}

const count = (counts: Partial<Record<VendorJobStatus, number>>, ...statuses: VendorJobStatus[]) =>
  statuses.reduce((total, status) => total + (counts[status] ?? 0), 0);

/** The four headline numbers on the vendor Home. */
export function homeCounts(summary: {
  counts: Partial<Record<VendorJobStatus, number>>;
  overdue: number;
}) {
  return {
    toAccept: count(summary.counts, "ASSIGNED"),
    working: count(summary.counts, "IN_PROGRESS", "RETURNED"),
    overdue: summary.overdue,
    inReview: count(summary.counts, "TEAM_REVIEW", "SUBMITTED"),
    done: count(summary.counts, "APPROVED"),
  };
}

/** "2026-11" to "November 2026"; `shift` moves by whole months. */
export function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shiftMonth(month: string, shift: number) {
  const [year, index] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, index - 1 + shift, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** This month in India time, as "2026-11". */
export function currentIstMonth(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}
