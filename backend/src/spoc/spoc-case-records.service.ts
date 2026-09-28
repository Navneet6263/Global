import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type {
  SpocCaseQueryDto,
  SpocPageQueryDto,
  SpocQaQueryDto,
} from "./dto/spoc-query.dto";
import { caseBucket, qaBucket, type BucketContext } from "./spoc-buckets";
import {
  SLA_APPROACHING_HOURS,
  activeTaskStatuses,
  holderOf,
  openVisitStatuses,
  statusesHeldBy,
  terminalCaseStatuses,
} from "./spoc-holder";
import { pageResult, paging, spocCaseWhere, spocRange } from "./spoc-scope";

/** Bucket context for a record list; case filters are already applied by the caller. */
export function bucketContext(
  actor: Actor,
  query: SpocPageQueryDto,
  now: Date,
): BucketContext {
  return {
    tenantId: actor.tenantId,
    caseWhere: {},
    clientPublicId: query.clientId,
    range: spocRange(query, now),
    now,
  };
}

const caseRowSelect = {
  publicId: true,
  caseNumber: true,
  externalRef: true,
  status: true,
  priority: true,
  riskLevel: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  subject: { select: { fullName: true } },
  client: { select: { publicId: true, displayName: true } },
  branch: { select: { name: true, city: true } },
  assignedOpsUser: { select: { publicId: true, displayName: true } },
  qaReviewer: { select: { displayName: true } },
  checks: {
    select: {
      status: true,
      tasks: {
        select: { status: true, assignee: { select: { displayName: true } } },
      },
    },
  },
  fieldVisits: {
    select: { status: true, assignee: { select: { displayName: true } } },
  },
} as const;

type CaseRow = {
  status: string;
  client: { displayName: string };
  assignedOpsUser: { displayName: string } | null;
  qaReviewer: { displayName: string } | null;
  checks: Array<{
    tasks: Array<{ status: string; assignee: { displayName: string } | null }>;
  }>;
  fieldVisits: Array<{
    status: string;
    assignee: { displayName: string } | null;
  }>;
};

/** Who is expected to act next, derived from the holder role and real assignment fields. */
export function currentOwner(row: CaseRow): string | null {
  const holder = holderOf(row.status);
  if (holder === "OPS_MANAGER")
    return row.assignedOpsUser?.displayName ?? "Unassigned";
  if (holder === "QA_REVIEWER")
    return row.qaReviewer?.displayName ?? "Unclaimed";
  if (holder === "CLIENT_ADMIN") return row.client.displayName;
  if (holder === "FINANCE_MANAGER") return "Finance";
  if (holder === "VERIFIER") {
    const names = new Set<string>();
    row.checks.forEach((check) =>
      check.tasks
        .filter(
          (task) => activeTaskStatuses.includes(task.status) && task.assignee,
        )
        .forEach((task) => names.add(task.assignee!.displayName)),
    );
    row.fieldVisits
      .filter(
        (visit) => openVisitStatuses.includes(visit.status) && visit.assignee,
      )
      .forEach((visit) => names.add(visit.assignee!.displayName));
    return names.size ? [...names].join(", ") : "Unassigned";
  }
  return null;
}

@Injectable()
export class SpocCaseRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async cases(actor: Actor, query: SpocCaseQueryDto) {
    const now = new Date();
    const soon = new Date(now.getTime() + SLA_APPROACHING_HOURS * 3_600_000);
    const live = { status: { notIn: terminalCaseStatuses } };
    const conditions: object[] = [spocCaseWhere(actor, query)];
    if (query.status) conditions.push({ status: query.status });
    else if (query.holderRole)
      conditions.push({ status: { in: statusesHeldBy(query.holderRole) } });
    else if (query.activeOnly) conditions.push(live);
    if (query.ownerId)
      conditions.push({ assignedOpsUser: { publicId: query.ownerId } });
    if (query.unassigned) conditions.push({ assignedOpsUserId: null, ...live });
    if (query.sla === "overdue")
      conditions.push({ dueAt: { lt: now }, ...live });
    if (query.sla === "approaching")
      conditions.push({ dueAt: { gte: now, lt: soon }, ...live });
    if (query.sla === "healthy")
      conditions.push({ OR: [{ dueAt: null }, { dueAt: { gte: soon } }] });
    if (query.bucket && query.bucket !== "exceptions")
      conditions.push(
        caseBucket(
          query.bucketRole ?? "OPS_MANAGER",
          query.bucket,
          bucketContext(actor, query, now),
        ),
      );
    if (query.search?.trim()) {
      const text = query.search.trim();
      conditions.push({
        OR: [
          { caseNumber: { contains: text } },
          { externalRef: { contains: text } },
          { subject: { fullName: { contains: text } } },
          { client: { displayName: { contains: text } } },
        ],
      });
    }
    const where = { AND: conditions };
    const [rows, total] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where,
        select: caseRowSelect,
        orderBy: [{ [query.sortBy]: query.sortDir }, { publicId: "asc" }],
        ...paging(query.page, query.pageSize),
      }),
      this.prisma.verificationCase.count({ where }),
    ]);
    const items = rows.map((row) => {
      const tasks = row.checks.flatMap((check) => check.tasks);
      return {
        id: row.publicId,
        caseNumber: row.caseNumber,
        externalRef: row.externalRef,
        status: row.status,
        holderRole: holderOf(row.status),
        currentOwner: currentOwner(row),
        priority: row.priority,
        riskLevel: row.riskLevel,
        dueAt: row.dueAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        completedAt: row.completedAt,
        overdue: Boolean(
          row.dueAt &&
          row.dueAt < now &&
          !terminalCaseStatuses.includes(row.status),
        ),
        candidateName: row.subject.fullName,
        client: {
          id: row.client.publicId,
          displayName: row.client.displayName,
        },
        branch: row.branch,
        opsOwner: row.assignedOpsUser?.displayName ?? null,
        checksCompleted: row.checks.filter(
          (check) => check.status === "COMPLETED",
        ).length,
        checksTotal: row.checks.length,
        blockedTasks: tasks.filter((task) => task.status === "BLOCKED").length,
        openVisits: row.fieldVisits.filter((visit) =>
          openVisitStatuses.includes(visit.status),
        ).length,
      };
    });
    return pageResult(items, total, query.page, query.pageSize);
  }

  async qa(actor: Actor, query: SpocQaQueryDto) {
    const caseScope = {
      ...spocCaseWhere(actor, query),
      ...(query.search?.trim()
        ? {
            OR: [
              { caseNumber: { contains: query.search.trim() } },
              { subject: { fullName: { contains: query.search.trim() } } },
            ],
          }
        : {}),
    };
    // A matrix bucket overrides the view so counts and lists stay identical.
    const target = query.bucket
      ? qaBucket(query.bucket, bucketContext(actor, query, new Date()))
      : null;
    const caseView =
      target?.source === "case" ||
      (!target && (query.view === "awaiting" || query.view === "claimed"));
    if (caseView) {
      const where = {
        AND: [
          caseScope,
          target?.source === "case"
            ? target.where
            : {
                status: "QA_REVIEW",
                qaReviewerId: query.view === "awaiting" ? null : { not: null },
              },
        ],
      };
      const [rows, total] = await Promise.all([
        this.prisma.verificationCase.findMany({
          where,
          select: {
            publicId: true,
            caseNumber: true,
            status: true,
            priority: true,
            dueAt: true,
            qaClaimedAt: true,
            subject: { select: { fullName: true } },
            client: { select: { displayName: true } },
            qaReviewer: { select: { displayName: true } },
          },
          orderBy: [{ dueAt: "asc" }, { publicId: "asc" }],
          ...paging(query.page, query.pageSize),
        }),
        this.prisma.verificationCase.count({ where }),
      ]);
      const items = rows.map((row) => ({
        id: row.publicId,
        caseId: row.publicId,
        caseNumber: row.caseNumber,
        candidateName: row.subject.fullName,
        clientName: row.client.displayName,
        caseStatus: row.status,
        priority: row.priority,
        dueAt: row.dueAt,
        reviewer: row.qaReviewer?.displayName ?? null,
        claimedAt: row.qaClaimedAt,
        decision: null,
        decidedAt: null,
      }));
      return pageResult(items, total, query.page, query.pageSize);
    }
    const where = {
      AND: [
        { case: caseScope },
        target?.source === "review"
          ? target.where
          : query.view === "rework"
            ? { decision: "REWORK" }
            : {},
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.qaReview.findMany({
        where,
        select: {
          publicId: true,
          decision: true,
          createdAt: true,
          reviewer: { select: { displayName: true } },
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              status: true,
              priority: true,
              dueAt: true,
              subject: { select: { fullName: true } },
              client: { select: { displayName: true } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { publicId: "asc" }],
        ...paging(query.page, query.pageSize),
      }),
      this.prisma.qaReview.count({ where }),
    ]);
    const items = rows.map((row) => ({
      id: row.publicId,
      caseId: row.case.publicId,
      caseNumber: row.case.caseNumber,
      candidateName: row.case.subject.fullName,
      clientName: row.case.client.displayName,
      caseStatus: row.case.status,
      priority: row.case.priority,
      dueAt: row.case.dueAt,
      reviewer: row.reviewer.displayName,
      claimedAt: null,
      decision: row.decision,
      decidedAt: row.createdAt,
    }));
    return pageResult(items, total, query.page, query.pageSize);
  }
}
