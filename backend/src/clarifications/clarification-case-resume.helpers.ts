import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { assertCandidateDocumentType } from "../documents/candidate-document-policy";
import { verifierDocumentTypes } from "../verification/check-documents";
import type { QaReadinessService } from "../verification/qa-readiness.service";
import { ACTIVE_CLARIFICATION_STATUSES } from "./clarification-status";

export async function resolveRequestedDocumentType(
  tx: Prisma.TransactionClient,
  caseId: bigint,
  checkType: string | null,
  rawType?: string,
): Promise<string | null> {
  const normalized = rawType?.trim().toUpperCase();
  if (!normalized) return null;
  await assertCandidateDocumentType(tx, caseId, normalized);
  if (
    checkType &&
    normalized !== "OTHER" &&
    !verifierDocumentTypes(checkType).includes(normalized)
  ) {
    throw new BadRequestException(
      `Document type ${normalized} is not associated with check ${checkType}`,
    );
  }
  return normalized;
}

export async function assertNoDuplicateActiveL2Clarification(
  tx: Prisma.TransactionClient,
  input: {
    caseId: bigint;
    checkId: bigint | null;
    requestedDocumentType: string | null;
  },
): Promise<void> {
  if (typeof tx.clarification?.findFirst !== "function") return;
  const conflictClauses: Prisma.ClarificationWhereInput[] = [
    { checkId: input.checkId },
  ];
  if (input.requestedDocumentType) {
    conflictClauses.push({
      requestedDocumentType: input.requestedDocumentType,
    });
  }
  const existing = await tx.clarification.findFirst({
    where: {
      caseId: input.caseId,
      level: "L2",
      status: { in: [...ACTIVE_CLARIFICATION_STATUSES] },
      OR: conflictClauses,
    },
    select: {
      publicId: true,
      checkId: true,
      requestedDocumentType: true,
    },
  });
  if (!existing) return;
  if (
    input.requestedDocumentType &&
    existing.requestedDocumentType === input.requestedDocumentType
  ) {
    throw new ConflictException(
      `An active L2 clarification already requests ${input.requestedDocumentType}`,
    );
  }
  throw new ConflictException(
    input.checkId
      ? "An active L2 clarification already exists for this check"
      : "An active case-level L2 clarification already exists",
  );
}

export async function resumeCaseAfterClarifications(
  tx: Prisma.TransactionClient,
  qaReadiness: QaReadinessService,
  input: {
    tenantId: bigint;
    caseId: bigint;
    casePublicId: string;
    caseStatus: string;
    caseNumber: string;
    branchId: bigint | null;
    clientId: bigint;
    workflowVersion: number;
    intakeStage: string | null;
    dataEntryUserId: bigint | null;
    changedById: bigint;
    reason: string;
  },
): Promise<{ remaining: number; caseStatus: string }> {
  const remaining = await tx.clarification.count({
    where: {
      caseId: input.caseId,
      status: { in: [...ACTIVE_CLARIFICATION_STATUSES] },
    },
  });
  let caseStatus = input.caseStatus;
  if (
    remaining === 0 &&
    input.workflowVersion === 2 &&
    input.intakeStage === "CORRECTION"
  ) {
    await tx.verificationCase.update({
      where: { id: input.caseId },
      data: { intakeStage: "DATA_ENTRY", version: { increment: 1 } },
    });
    if (input.dataEntryUserId) {
      await tx.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.dataEntryUserId,
          type: "CORRECTION_RECEIVED",
          title: "Correction received",
          body: `${input.caseNumber}: every correction is resolved. Recheck and mark Ready.`,
          href: `/data-entry?caseId=${input.casePublicId}`,
        },
      });
    }
  }
  if (remaining === 0 && input.caseStatus === "CLARIFICATION_PENDING") {
    const qaReady = await qaReadiness.promoteIfReady(tx, {
      tenantId: input.tenantId,
      caseId: input.caseId,
      casePublicId: input.casePublicId,
      branchId: input.branchId,
      clientId: input.clientId,
      changedById: input.changedById,
      fromStatus: "CLARIFICATION_PENDING",
      reason: "All clarifications resolved after check completion",
    });
    if (qaReady) {
      caseStatus = "QA_REVIEW";
    } else {
      const resumed = await tx.verificationCase.updateMany({
        where: {
          id: input.caseId,
          status: "CLARIFICATION_PENDING",
        },
        data: { status: "IN_PROGRESS", version: { increment: 1 } },
      });
      if (resumed.count === 1) {
        caseStatus = "IN_PROGRESS";
        await tx.caseStatusHistory.create({
          data: {
            caseId: input.caseId,
            fromStatus: "CLARIFICATION_PENDING",
            toStatus: "IN_PROGRESS",
            changedById: input.changedById,
            reason: input.reason,
          },
        });
      }
    }
  }
  return { remaining, caseStatus };
}
