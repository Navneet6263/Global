import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";

export function documentExpiry(value?: string): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException("Document expiry must be YYYY-MM-DD");
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException("Document expiry is not a valid date");
  }
  return date;
}

export async function assertNotDuplicateDocument(
  tx: Prisma.TransactionClient,
  tenantId: bigint,
  caseId: bigint,
  sha256: string,
) {
  const duplicate = await tx.documentVersion.findFirst({
    where: { sha256, document: { tenantId, caseId } },
    select: { id: true },
  });
  if (duplicate)
    throw new ConflictException(
      "This file is already attached to this case. Review the existing document or upload corrected evidence.",
    );
}

export async function lockMutableCaseEvidence(
  tx: Prisma.TransactionClient,
  caseId: bigint,
  allowQa = false,
) {
  const locked = await tx.verificationCase.updateMany({
    where: {
      id: caseId,
      status: {
        in: [
          "DRAFT",
          "CONSENT_PENDING",
          "DOCUMENT_PENDING",
          "IN_PROGRESS",
          "CLARIFICATION_PENDING",
          ...(allowQa ? ["QA_REVIEW"] : []),
        ],
      },
    },
    data: { version: { increment: 1 } },
  });
  if (locked.count !== 1)
    throw new ConflictException(
      "Case stage changed; reopen the case before updating evidence",
    );
}
