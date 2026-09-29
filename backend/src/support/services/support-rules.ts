import { BadRequestException, ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import { terminalCaseStatuses } from "../../spoc/spoc-holder";

export const SupportRequestStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
] as const;
export type SupportRequestStatus = (typeof SupportRequestStatuses)[number];

/** The two statuses an agent can move a request to (OPEN is only ever the start). */
export const SupportUpdateStatuses = ["IN_PROGRESS", "RESOLVED"] as const;
export type SupportUpdateStatus = (typeof SupportUpdateStatuses)[number];

export const SupportRequesterTypes = ["CANDIDATE", "CLIENT_ADMIN"] as const;
export type SupportRequesterType = (typeof SupportRequesterTypes)[number];

/** Where an employee's case stands for support purposes. */
export const SupportCaseStates = [
  "PENDING",
  "COMPLETED",
  "EXCEPTION",
  "CANCELLED",
] as const;
export type SupportCaseState = (typeof SupportCaseStates)[number];

export const SUPPORT_SUBJECT_MAX = 160;
export const SUPPORT_MESSAGE_MAX = 2000;
export const SUPPORT_TEXT_MIN = 5;

/** Unresolved requests one requester may have at a time (spam guard). */
export const OPEN_REQUEST_LIMIT: Record<SupportRequesterType, number> = {
  CANDIDATE: 5,
  CLIENT_ADMIN: 20,
};

export const CORRECTION_DOCUMENT_STATUSES = ["REJECTED", "REUPLOAD_REQUIRED"];
export const OPEN_CLARIFICATION_STATUSES = ["OPEN", "RESPONDED"];
const COMPLETED_STATUSES = ["COMPLETED", "CLOSED"];

/** Trimmed, length-checked free text; blank or too short is refused. */
export function supportText(
  value: string | undefined,
  label: string,
  max: number,
): string {
  const text = value?.trim() ?? "";
  if (text.length < SUPPORT_TEXT_MIN || text.length > max)
    throw new BadRequestException(
      `${label} must be ${SUPPORT_TEXT_MIN} to ${max} characters`,
    );
  return text;
}

/** SR-YYYYMMDD-XXXXXX, the same shape as case numbers. */
export function supportRequestNumber(now = new Date()): string {
  return `SR-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

/** OPEN → IN_PROGRESS → RESOLVED, or OPEN → RESOLVED. RESOLVED is final. */
export function assertSupportTransition(
  from: string,
  to: SupportUpdateStatus,
): void {
  const allowed =
    (from === "OPEN" && (to === "IN_PROGRESS" || to === "RESOLVED")) ||
    (from === "IN_PROGRESS" && to === "RESOLVED");
  if (!allowed)
    throw new ConflictException(
      from === "RESOLVED"
        ? "This request is already resolved; the requester can raise a new one"
        : `A ${from.toLowerCase().replaceAll("_", " ")} request cannot move to ${to.toLowerCase().replaceAll("_", " ")}`,
    );
}

export interface SupportCaseFacts {
  status: string;
  dueAt: Date | null;
  blockedTasks: number;
  documentStatuses: readonly string[];
  openClarifications: number;
}

/**
 * The support view of a case. Terminal cases are COMPLETED or CANCELLED; a live case
 * is an EXCEPTION when it is overdue, has blocked work, a document needing
 * correction or an unanswered clarification, and PENDING otherwise.
 */
export function caseSupportState(
  facts: SupportCaseFacts,
  now: Date,
): { state: SupportCaseState; reasons: string[] } {
  if (facts.status === "CANCELLED") return { state: "CANCELLED", reasons: [] };
  if (COMPLETED_STATUSES.includes(facts.status))
    return { state: "COMPLETED", reasons: [] };
  const reasons: string[] = [];
  if (facts.dueAt && facts.dueAt < now) reasons.push("Overdue");
  if (facts.blockedTasks)
    reasons.push(
      `${facts.blockedTasks} blocked task${facts.blockedTasks === 1 ? "" : "s"}`,
    );
  const corrections = facts.documentStatuses.filter((status) =>
    CORRECTION_DOCUMENT_STATUSES.includes(status),
  ).length;
  if (corrections)
    reasons.push(
      corrections === 1
        ? "Document re-upload required"
        : `${corrections} documents need re-upload`,
    );
  if (facts.openClarifications) reasons.push("Awaiting clarification");
  return { state: reasons.length ? "EXCEPTION" : "PENDING", reasons };
}

/** The same rule as caseSupportState, as a Prisma filter, so counts and lists agree. */
function exceptionConditions(now: Date): Prisma.VerificationCaseWhereInput[] {
  return [
    // `not: null` keeps NOT (...) true for cases without a due date.
    { dueAt: { not: null, lt: now } },
    { checks: { some: { tasks: { some: { status: "BLOCKED" } } } } },
    {
      documents: { some: { status: { in: CORRECTION_DOCUMENT_STATUSES } } },
    },
    {
      clarifications: {
        some: { status: { in: OPEN_CLARIFICATION_STATUSES } },
      },
    },
  ];
}

export function supportStateWhere(
  state: SupportCaseState,
  now: Date,
): Prisma.VerificationCaseWhereInput {
  if (state === "CANCELLED") return { status: "CANCELLED" };
  if (state === "COMPLETED") return { status: { in: COMPLETED_STATUSES } };
  const live = { status: { notIn: terminalCaseStatuses } };
  return state === "EXCEPTION"
    ? { ...live, OR: exceptionConditions(now) }
    : { ...live, NOT: { OR: exceptionConditions(now) } };
}
