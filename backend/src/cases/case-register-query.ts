import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import type { Prisma } from "../generated/prisma/client";
import type { CaseQueryDto } from "./dto/case-query.dto";

const stageStatuses: Record<NonNullable<CaseQueryDto["stage"]>, string[]> = {
  intake: ["DRAFT"],
  consent: ["CONSENT_PENDING"],
  documents: ["DOCUMENT_PENDING"],
  verification: ["IN_PROGRESS"],
  clarification: ["CLARIFICATION_PENDING"],
  qa: ["QA_REVIEW"],
  completed: ["COMPLETED", "CLOSED", "CANCELLED"],
  cancelled: ["CANCELLED"],
  assignment: ["IN_PROGRESS"],
  field_visit: ["IN_PROGRESS", "CLARIFICATION_PENDING"],
};

export function caseRegisterWhere(
  actor: Actor,
  query: CaseQueryDto,
  now = new Date(),
): Prisma.VerificationCaseWhereInput {
  const and: Prisma.VerificationCaseWhereInput[] = [];
  if (query.view === "operations" && query.stage === "completed") {
    and.push({ status: { in: ["COMPLETED", "CLOSED"] } });
  }
  if (query.risk) {
    and.push(
      query.risk === "high"
        ? { riskLevel: { in: ["HIGH", "CRITICAL"] } }
        : query.risk === "medium"
          ? { riskLevel: "MEDIUM" }
          : { OR: [{ riskLevel: "LOW" }, { riskLevel: null }] },
    );
  }
  if (query.unassigned) and.push({ assignedOpsUserId: null });
  if (query.ownerId) and.push({ assignedOpsUser: { publicId: query.ownerId } });
  else if (query.owner)
    and.push({ assignedOpsUser: { displayName: query.owner } });
  if (query.dueToday || query.dueNext7Days) {
    const end = query.dueToday
      ? new Date(now)
      : new Date(now.getTime() + 7 * 86_400_000);
    if (query.dueToday) end.setHours(23, 59, 59, 999);
    and.push({ dueAt: { gte: now, lte: end } });
  }
  if (query.stage === "assignment")
    and.push({
      checks: {
        some: {
          status: { not: "COMPLETED" },
          tasks: {
            none: {
              status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
              assigneeId: { not: null },
            },
          },
        },
      },
    });
  if (query.stage === "field_visit")
    and.push({
      fieldVisits: {
        some: {
          status: { in: ["ASSIGNED", "IN_PROGRESS", "EXCEPTION_REVIEW"] },
        },
      },
    });
  const search = query.search?.trim();
  if (search) {
    and.push({
      OR: [
        { caseNumber: { contains: search } },
        { externalRef: { contains: search } },
        { subject: { fullName: { contains: search } } },
        { client: { displayName: { contains: search } } },
        { assignedOpsUser: { displayName: { contains: search } } },
      ],
    });
  }
  if (query.sla) {
    const approachingAt = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
    and.push(
      query.sla === "overdue"
        ? { dueAt: { lt: now } }
        : query.sla === "approaching"
          ? { dueAt: { gte: now, lte: approachingAt } }
          : { OR: [{ dueAt: null }, { dueAt: { gt: approachingAt } }] },
    );
  }

  return {
    ...caseAccessScope(actor),
    ...(query.status
      ? { status: query.status }
      : query.stage
        ? { status: { in: stageStatuses[query.stage] } }
        : {}),
    ...(query.clientId ? { client: { publicId: query.clientId } } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: inclusiveDateEnd(query.to) } : {}),
          },
        }
      : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

export function caseRegisterOrder(
  query: CaseQueryDto,
): Prisma.VerificationCaseOrderByWithRelationInput[] {
  const direction = query.sortDir ?? "desc";
  if (query.sortBy === "candidateName") {
    return [{ subject: { fullName: direction } }, { publicId: "desc" }];
  }
  if (query.sortBy === "sla") {
    return [{ dueAt: direction }, { publicId: "desc" }];
  }
  return [{ updatedAt: direction }, { publicId: "desc" }];
}

function inclusiveDateEnd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);
}
