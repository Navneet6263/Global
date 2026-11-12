import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { isCaseSubmissionComplete } from "./intake-eligibility.helpers";
import {
  RM_EXCLUDED_STATUSES,
  SUBMISSION_COMPLETE_AUDIT_ACTIONS,
} from "./intake-queue.presenter";

/**
 * Resolves IDs of historical `DOCUMENT_PENDING` + `INTAKE` cases whose portal links were
 * pruned by housekeeping ONLY if permanent audit or full team-upload proof confirms real
 * submission. All unverified / partial / unsubmitted deleted-link cases remain fail-closed.
 */
export async function findConfirmedDeletedLinkIntakeIds(
  prisma: PrismaService,
  tenantId: bigint,
): Promise<bigint[]> {
  if (
    typeof prisma.verificationCase?.findMany !== "function" ||
    typeof prisma.auditEvent?.findMany !== "function"
  ) {
    return [];
  }
  const candidates = await prisma.verificationCase.findMany({
    where: {
      tenantId,
      workflowVersion: 2,
      status: "DOCUMENT_PENDING",
      intakeStage: "INTAKE",
      dataEntryAssignedAt: null,
      dataEntryReadyAt: null,
      consents: { none: { status: { in: ["REQUESTED", "WITHDRAWN"] } } },
      candidateAccess: { none: { completedAt: { not: null } } },
    },
    select: {
      id: true,
      publicId: true,
      candidateAccess: {
        where: { completedAt: null, revokedAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!candidates.length) return [];

  const audits = await prisma.auditEvent.findMany({
    where: {
      tenantId,
      resourceType: "case",
      resourcePublicId: { in: candidates.map((row) => row.publicId) },
      action: { in: [...SUBMISSION_COMPLETE_AUDIT_ACTIONS] },
    },
    select: { resourcePublicId: true },
  });
  const confirmedPublicIds = new Set(audits.map((row) => row.resourcePublicId));
  const verifiedIds: bigint[] = [];
  for (const row of candidates) {
    if (row.candidateAccess.length > 0) continue;
    const submission = await isCaseSubmissionComplete(prisma, row.id);
    if (!submission.complete) continue;
    const confirmedByAudit = confirmedPublicIds.has(row.publicId);
    const confirmedByTeamUpload =
      submission.requestedTypes.length > 0 && submission.hasTeamUpload;
    if (confirmedByAudit || confirmedByTeamUpload) {
      verifiedIds.push(row.id);
    }
  }
  return verifiedIds;
}

export function rmEligibleWhereWithLegacyIds(
  verifiedLegacyIds: readonly bigint[],
  base: Prisma.VerificationCaseWhereInput,
  ...extra: Array<Prisma.VerificationCaseWhereInput | undefined>
): Prisma.VerificationCaseWhereInput {
  const baseAnd = base.AND
    ? Array.isArray(base.AND)
      ? base.AND
      : [base.AND]
    : [];
  const filteredExtra = extra.filter(
    (entry): entry is Prisma.VerificationCaseWhereInput => Boolean(entry),
  );
  const mergedAnd = [...baseAnd, ...filteredExtra];
  return {
    ...base,
    status: { notIn: RM_EXCLUDED_STATUSES },
    consents: { none: { status: { in: ["REQUESTED", "WITHDRAWN"] } } },
    NOT: [
      { intakeStage: { in: ["CANDIDATE_UPLOAD", "CLIENT_RETURNED"] } },
      {
        ...(verifiedLegacyIds.length
          ? { id: { notIn: [...verifiedLegacyIds] } }
          : {}),
        status: "DOCUMENT_PENDING",
        intakeStage: "INTAKE",
        dataEntryAssignedAt: null,
        dataEntryReadyAt: null,
        candidateAccess: { none: { completedAt: { not: null } } },
      },
    ],
    ...(mergedAnd.length ? { AND: mergedAnd } : {}),
  };
}
