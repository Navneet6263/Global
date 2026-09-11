import type { Prisma } from "../generated/prisma/client";

// ADDRESS is advertised as "Address (physical)" at intake. The persisted
// CaseCheck is the immutable requirement, including cases created before this fix.
// Never infer scope from today's mutable package or a client-supplied flag.
export function physicalFieldIssues(
  checks: ReadonlyArray<{ type: string }>,
  visits: ReadonlyArray<{ status: string }>,
): string[] {
  const required = checks.some((check) => check.type === "ADDRESS");
  const issues: string[] = [];
  if (required && !visits.some((visit) => visit.status === "COMPLETED")) {
    issues.push(
      "Physical address verification required: assign a Field Executive and obtain supervisor-approved field evidence before QA",
    );
  }
  const pending = visits.filter(
    (visit) => !["COMPLETED", "CANCELLED"].includes(visit.status),
  ).length;
  if (pending)
    issues.push(
      `${pending} field visit(s) awaiting completion or supervisor review`,
    );
  return issues;
}

// Keep the database queue/claim filter equivalent to physicalFieldIssues.
// A cancelled visit is never proof of a completed physical address check.
export function fieldQaWhere(): Prisma.VerificationCaseWhereInput {
  return {
    AND: [
      {
        OR: [
          { checks: { none: { type: "ADDRESS" } } },
          { fieldVisits: { some: { status: "COMPLETED" } } },
        ],
      },
      {
        fieldVisits: {
          none: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        },
      },
    ],
  };
}
