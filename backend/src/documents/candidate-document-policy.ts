import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { requiredDocumentTypes } from "./evidence-readiness";

const candidateTypes = new Set([
  "AADHAAR",
  "PAN",
  "PASSPORT",
  "DRIVING_LICENCE",
  "ADDRESS_PROOF",
  "EDUCATION_CERTIFICATE",
  "EMPLOYMENT_PROOF",
]);

export async function assertCandidateDocumentType(
  tx: Prisma.TransactionClient,
  caseId: bigint,
  type: string,
) {
  if (candidateTypes.has(type)) return;
  if (type === "OTHER") {
    const services = await tx.caseService.findMany({
      where: { caseId },
      select: { requiredDocumentsJson: true },
    });
    if (
      services.some((service) =>
        requiredDocumentTypes(service.requiredDocumentsJson).includes("OTHER"),
      )
    )
      return;
  }
  throw new BadRequestException(
    "This document type was not requested for candidate upload",
  );
}
