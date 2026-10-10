import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import { fieldQaWhere } from "../field-visits/physical-field-policy";
import { claimCutoff } from "./qa-claim";
import { qaScope } from "./qa-register";

const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000;
const HIGH = ["HIGH", "CRITICAL"];

/** Start of the IST calendar day containing `at`, as a UTC instant. */
export function istDayStart(at: Date) {
  const shifted = at.getTime() + IST_OFFSET;
  return new Date(shifted - (shifted % DAY) - IST_OFFSET);
}
const istDayKey = (at: Date) =>
  new Date(at.getTime() + IST_OFFSET).toISOString().slice(0, 10);

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * QA dashboard: the live review queue (SLA, risk, how long cases have waited, who holds
 * them), the reviewer's own decisions over 14 / 30 days, approval rate, median review
 * time and which check types the reviewer returns most. Read-only, tenant / branch scoped.
 */
export async function readQaDashboard(
  prisma: PrismaService,
  actor: Actor,
  now = new Date(),
) {
  const cutoff = claimCutoff(now);
  const today = istDayStart(now);
  const tomorrow = new Date(today.getTime() + DAY);
  const since14 = new Date(today.getTime() - 13 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);
  const [queue, reviews, teamToday, reworkTasks] = await Promise.all([
    prisma.verificationCase.findMany({
      where: { ...qaScope(actor), status: "QA_REVIEW", AND: [fieldQaWhere()] },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: 500,
      select: {
        publicId: true,
        caseNumber: true,
        priority: true,
        dueAt: true,
        createdAt: true,
        qaReviewerId: true,
        qaClaimedAt: true,
        qaReviewer: { select: { displayName: true } },
        subject: { select: { fullName: true } },
        client: { select: { displayName: true } },
        checks: { select: { riskLevel: true } },
        statusHistory: {
          where: { toStatus: "QA_REVIEW" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.qaReview.findMany({
      where: { reviewerId: actor.userId, createdAt: { gte: since30 } },
      orderBy: { createdAt: "desc" },
      select: {
        publicId: true,
        decision: true,
        createdAt: true,
        caseId: true,
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            status: true,
            subject: { select: { fullName: true } },
            client: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.qaReview.count({
      where: { createdAt: { gte: today }, case: qaScope(actor) },
    }),
    prisma.auditEvent.findMany({
      where: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "qa.rework-task-created",
        createdAt: { gte: since30 },
      },
      select: { afterJson: true },
      take: 500,
    }),
  ]);

  // Queue health.
  const live = (claimedAt: Date | null) =>
    Boolean(claimedAt && claimedAt > cutoff);
  const waitedHours = (row: (typeof queue)[number]) =>
    (now.getTime() -
      (row.statusHistory[0]?.createdAt ?? row.createdAt).getTime()) /
    3_600_000;
  const sla = { overdue: 0, dueToday: 0, later: 0, noDueDate: 0 };
  const waiting = { under4h: 0, under24h: 0, under3d: 0, over3d: 0 };
  let mine = 0;
  let others = 0;
  let highRisk = 0;
  for (const row of queue) {
    if (!row.dueAt) sla.noDueDate += 1;
    else if (row.dueAt < now) sla.overdue += 1;
    else if (row.dueAt < tomorrow) sla.dueToday += 1;
    else sla.later += 1;
    const hours = waitedHours(row);
    if (hours < 4) waiting.under4h += 1;
    else if (hours < 24) waiting.under24h += 1;
    else if (hours < 72) waiting.under3d += 1;
    else waiting.over3d += 1;
    if (live(row.qaClaimedAt))
      if (row.qaReviewerId === actor.userId) mine += 1;
      else others += 1;
    if (row.checks.some((check) => HIGH.includes(check.riskLevel ?? "")))
      highRisk += 1;
  }
  // Up next: my reserved cases first, then unreserved ones by due date.
  const upNext = queue
    .filter(
      (row) => !live(row.qaClaimedAt) || row.qaReviewerId === actor.userId,
    )
    .sort((a, b) => {
      const mineA = live(a.qaClaimedAt) && a.qaReviewerId === actor.userId;
      const mineB = live(b.qaClaimedAt) && b.qaReviewerId === actor.userId;
      if (mineA !== mineB) return mineA ? -1 : 1;
      return (
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)
      );
    })
    .slice(0, 6)
    .map((row) => ({
      id: row.publicId,
      caseNumber: row.caseNumber,
      candidateName: row.subject.fullName,
      clientName: row.client.displayName,
      priority: row.priority,
      dueAt: row.dueAt,
      checks: row.checks.length,
      highRisk: row.checks.some((check) =>
        HIGH.includes(check.riskLevel ?? ""),
      ),
      reservedByMe: live(row.qaClaimedAt) && row.qaReviewerId === actor.userId,
      waitingHours: Math.round(waitedHours(row) * 10) / 10,
    }));

  // My decisions.
  const trend = Array.from({ length: 14 }, (_, index) => ({
    date: istDayKey(new Date(since14.getTime() + index * DAY)),
    approved: 0,
    returned: 0,
  }));
  const byDay = new Map(trend.map((day) => [day.date, day]));
  let approved30 = 0;
  let returned30 = 0;
  let todayCount = 0;
  let week = 0;
  let previousWeek = 0;
  const weekStart = new Date(today.getTime() - 6 * DAY);
  const previousWeekStart = new Date(today.getTime() - 13 * DAY);
  for (const review of reviews) {
    const approvedDecision = review.decision === "APPROVED";
    if (approvedDecision) approved30 += 1;
    else returned30 += 1;
    if (review.createdAt >= today) todayCount += 1;
    if (review.createdAt >= weekStart) week += 1;
    else if (review.createdAt >= previousWeekStart) previousWeek += 1;
    const day = byDay.get(istDayKey(review.createdAt));
    if (day) {
      if (approvedDecision) day.approved += 1;
      else day.returned += 1;
    }
  }
  // Median minutes from a case reaching QA to my decision on it.
  const entries = reviews.length
    ? await prisma.caseStatusHistory.findMany({
        where: {
          caseId: { in: [...new Set(reviews.map((review) => review.caseId))] },
          toStatus: "QA_REVIEW",
        },
        select: { caseId: true, createdAt: true },
      })
    : [];
  const minutes = reviews.flatMap((review) => {
    const entered = entries
      .filter(
        (entry) =>
          entry.caseId === review.caseId && entry.createdAt <= review.createdAt,
      )
      .reduce<Date | null>(
        (latest, entry) =>
          !latest || entry.createdAt > latest ? entry.createdAt : latest,
        null,
      );
    return entered
      ? [(review.createdAt.getTime() - entered.getTime()) / 60_000]
      : [];
  });

  // Check types I return most.
  const reworkIds = reworkTasks.flatMap((event) => {
    try {
      const parsed = JSON.parse(event.afterJson ?? "{}") as {
        checkId?: unknown;
      };
      return typeof parsed.checkId === "string" ? [parsed.checkId] : [];
    } catch {
      return [];
    }
  });
  const reworkChecks = reworkIds.length
    ? await prisma.caseCheck.findMany({
        where: { tenantId: actor.tenantId, publicId: { in: reworkIds } },
        select: { type: true },
      })
    : [];
  const reworkByType = new Map<string, number>();
  for (const check of reworkChecks)
    reworkByType.set(check.type, (reworkByType.get(check.type) ?? 0) + 1);

  return {
    generatedAt: now,
    queue: {
      awaiting: queue.length,
      available: queue.length - mine - others,
      mine,
      reservedByOthers: others,
      highRisk,
      sla,
      waiting,
    },
    me: {
      today: todayCount,
      week,
      previousWeek,
      approved30,
      returned30,
      approvalRate:
        approved30 + returned30
          ? Math.round((approved30 / (approved30 + returned30)) * 100)
          : null,
      medianReviewMinutes: minutes.length ? Math.round(median(minutes)!) : null,
    },
    teamToday,
    trend,
    upNext,
    reworkByType: [...reworkByType.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    recent: reviews.slice(0, 6).map((review) => ({
      id: review.publicId,
      decision: review.decision,
      createdAt: review.createdAt,
      caseId: review.case.publicId,
      caseNumber: review.case.caseNumber,
      caseStatus: review.case.status,
      candidateName: review.case.subject.fullName,
      clientName: review.case.client.displayName,
    })),
  };
}
