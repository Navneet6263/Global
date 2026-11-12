import { ConflictException } from "@nestjs/common";
import {
  candidateRequestedTypes,
  candidateUploadItems,
} from "../candidate-portal/candidate-upload-state";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import { requiredDocumentTypes } from "../documents/evidence-readiness";
import type { Prisma } from "../generated/prisma/client";
import { applyIntakeRules } from "./intake-rules";
import { SUBMISSION_COMPLETE_AUDIT_ACTIONS } from "./intake-queue.presenter";

export {
  findConfirmedDeletedLinkIntakeIds,
  rmEligibleWhereWithLegacyIds,
} from "./intake-legacy-eligibility.helpers";

type DbClient = PrismaService | Prisma.TransactionClient;

type IntakeCheckDoc = {
  type: string;
  status: string;
  currentVersion: number;
  reviewNote: string | null;
  versions?: Array<{ malwareState: string }>;
};

export async function isCaseSubmissionComplete(
  db: DbClient,
  caseId: bigint,
): Promise<{
  requestedTypes: string[];
  complete: boolean;
  hasTeamUpload: boolean;
}> {
  const [services, checks, documents] = await Promise.all([
    db.caseService.findMany({
      where: { caseId },
      select: { requiredDocumentsJson: true },
    }),
    db.caseCheck.findMany({
      where: { caseId },
      select: { type: true },
    }),
    db.document.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        status: true,
        currentVersion: true,
        reviewNote: true,
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { malwareState: true, uploadedById: true },
        },
      },
    }),
  ]);
  const required = [
    ...new Set(
      services.flatMap((service) =>
        requiredDocumentTypes(service.requiredDocumentsJson),
      ),
    ),
  ];
  const requestedTypes = candidateRequestedTypes(required, checks);
  const sanitizedDocs: IntakeCheckDoc[] = documents.map((doc) => ({
    ...doc,
    // Fail closed if the latest version is missing or failed malware inspection.
    currentVersion:
      doc.currentVersion > 0 && doc.versions[0]?.malwareState === "CLEAN"
        ? doc.currentVersion
        : 0,
  }));
  const uploads = candidateUploadItems(requestedTypes, sanitizedDocs);
  const hasTeamUpload = documents.some(
    (doc) =>
      doc.currentVersion > 0 &&
      doc.versions[0]?.malwareState === "CLEAN" &&
      doc.versions[0]?.uploadedById !== null,
  );
  return { requestedTypes, complete: uploads.complete, hasTeamUpload };
}

/**
 * Promotes a `CANDIDATE_UPLOAD` case only when internal team uploads have satisfied every
 * required document cleanly (partial uploads never promote; 0-doc packages still require
 * the candidate's explicit submission step).
 */
export async function promoteIntakeAfterTeamUpload(
  tx: Prisma.TransactionClient,
  actor: Actor,
  caseId: bigint,
  casePublicId: string,
) {
  const record = await tx.verificationCase.findUnique({
    where: { id: caseId },
    select: {
      tenantId: true,
      caseNumber: true,
      status: true,
      workflowVersion: true,
      intakeStage: true,
      consents: {
        where: { status: { in: ["REQUESTED", "WITHDRAWN"] } },
        select: { id: true },
        take: 1,
      },
      clarifications: {
        where: {
          level: "L2",
          status: {
            in: [
              "OPEN",
              "RESPONDED",
              "CANDIDATE_SUBMITTED",
              "DATA_ENTRY_PENDING",
            ],
          },
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (
    !record ||
    record.workflowVersion !== 2 ||
    record.status !== "DOCUMENT_PENDING" ||
    record.intakeStage !== "CANDIDATE_UPLOAD" ||
    record.consents.length > 0 ||
    record.clarifications.length > 0
  ) {
    return;
  }
  const { requestedTypes, complete } = await isCaseSubmissionComplete(tx, caseId);
  if (!requestedTypes.length || !complete) return;

  const now = new Date();
  await tx.candidatePortalAccess.updateMany({
    where: { caseId, completedAt: null, revokedAt: null },
    data: { completedAt: now, revokedAt: now },
  });
  await tx.auditEvent.create({
    data: {
      tenantId: record.tenantId,
      actorUserId: actor.userId,
      action: "case.team-documents-completed",
      resourceType: "case",
      resourcePublicId: casePublicId,
      afterJson: JSON.stringify({
        caseNumber: record.caseNumber,
        documents: requestedTypes,
      }),
    },
  });
  await applyIntakeRules(tx, caseId);
}

export async function assertAssignDataEntrySubmissionReady(
  prisma: PrismaService,
  tenantId: bigint,
  current: {
    id: bigint;
    publicId: string;
    status: string;
    intakeStage: string | null;
    dataEntryAssignedAt?: Date | null;
    dataEntryReadyAt?: Date | null;
  },
) {
  if (
    current.intakeStage === "CANDIDATE_UPLOAD" ||
    current.intakeStage === "CLIENT_RETURNED"
  ) {
    throw new ConflictException(
      "Candidate documents must be submitted before assigning Data Entry",
    );
  }
  if (
    current.status !== "DOCUMENT_PENDING" ||
    current.intakeStage !== "INTAKE" ||
    current.dataEntryAssignedAt ||
    current.dataEntryReadyAt ||
    typeof prisma.candidatePortalAccess?.findFirst !== "function"
  ) {
    return;
  }

  const completedAccess = await prisma.candidatePortalAccess.findFirst({
    where: { caseId: current.id, completedAt: { not: null } },
    select: { id: true },
  });
  const openAccess = completedAccess
    ? null
    : await prisma.candidatePortalAccess.findFirst({
        where: { caseId: current.id, completedAt: null, revokedAt: null },
        select: { id: true },
      });
  if (openAccess) {
    throw new ConflictException(
      "Candidate documents must be submitted before assigning Data Entry",
    );
  }

  const submission = await isCaseSubmissionComplete(prisma, current.id);
  if (!submission.complete) {
    throw new ConflictException(
      "Candidate documents must be submitted before assigning Data Entry",
    );
  }
  if (completedAccess) return;

  const audit =
    typeof prisma.auditEvent?.findFirst === "function"
      ? await prisma.auditEvent.findFirst({
          where: {
            tenantId,
            resourceType: "case",
            resourcePublicId: current.publicId,
            action: { in: [...SUBMISSION_COMPLETE_AUDIT_ACTIONS] },
          },
          select: { id: true },
        })
      : null;
  const teamConfirmed =
    submission.requestedTypes.length > 0 && submission.hasTeamUpload;
  if (!audit && !teamConfirmed) {
    throw new ConflictException(
      "Candidate documents must be submitted before assigning Data Entry",
    );
  }
}
