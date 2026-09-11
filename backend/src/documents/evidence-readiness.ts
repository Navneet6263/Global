import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { caseMethodIssues } from "../verification/case-method-readiness";
import { physicalFieldIssues } from "../field-visits/physical-field-policy";

export const DOCUMENT_TYPES = [
  "AADHAAR",
  "PAN",
  "PASSPORT",
  "DRIVING_LICENCE",
  "ADDRESS_PROOF",
  "EDUCATION_CERTIFICATE",
  "EMPLOYMENT_PROOF",
  "OTHER",
] as const;

export function requiredDocumentTypes(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (type) =>
          typeof type !== "string" ||
          !DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number]),
      )
    ) {
      throw new Error("Invalid required document policy");
    }
    return [...new Set(parsed as string[])];
  } catch {
    throw new BadRequestException(
      "Required document policy is invalid; ask an administrator to correct the package",
    );
  }
}

type EvidenceDocument = {
  type: string;
  status: string;
  currentVersion: number;
  expiresAt: Date | null;
  createdAt?: Date;
};

export function documentReadiness(
  requiredTypes: string[],
  documents: EvidenceDocument[],
  now = new Date(),
) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const issues: string[] = [];
  const latest = new Map<string, EvidenceDocument>();
  for (const doc of documents) {
    const previous = latest.get(doc.type);
    if (
      !previous ||
      (doc.createdAt?.getTime() ?? 0) >= (previous.createdAt?.getTime() ?? 0)
    )
      latest.set(doc.type, doc);
  }
  const current = [...latest.values()];
  for (const type of requiredTypes) {
    const matching = current.filter(
      (doc) => doc.type === type && doc.currentVersion > 0,
    );
    const ready = matching.some(
      (doc) =>
        doc.status === "VERIFIED" && (!doc.expiresAt || doc.expiresAt >= today),
    );
    if (!ready)
      issues.push(
        `${type}: ${!matching.length ? "upload required" : "reviewed, unexpired document required"}`,
      );
  }
  for (const doc of current) {
    if (["REJECTED", "REUPLOAD_REQUIRED"].includes(doc.status)) {
      issues.push(`${doc.type}: correction and review required`);
    }
  }
  return {
    ready: issues.length === 0,
    issues: [...new Set(issues)],
    requiredTypes,
  };
}

export async function caseEvidenceReadiness(
  tx: Prisma.TransactionClient,
  caseId: bigint,
  options: { includeWork?: boolean } = {},
) {
  const record = await tx.verificationCase.findUnique({
    where: { id: caseId },
    select: {
      ...(options.includeWork !== false
        ? {
            checks: { select: { type: true } },
            fieldVisits: { select: { status: true } },
          }
        : {}),
      documents: {
        select: {
          type: true,
          status: true,
          currentVersion: true,
          expiresAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!record) throw new NotFoundException("Case not found");
  const services = await tx.caseService.findMany({
    where: { caseId },
    select: { requiredDocumentsJson: true },
  });
  // Pre-upgrade cases had no required-document policy. Never apply a later
  // package edit retroactively; new intake always stores immutable snapshots.
  const requiredTypes = [
    ...new Set(
      services.flatMap((service) =>
        requiredDocumentTypes(service.requiredDocumentsJson),
      ),
    ),
  ];
  const result = documentReadiness(requiredTypes, record.documents);
  if (options.includeWork !== false) {
    result.issues.push(...(await caseMethodIssues(tx, caseId)));
    const clarifications = await tx.clarification.count({
      where: { caseId, status: { in: ["OPEN", "RESPONDED"] } },
    });
    if (clarifications)
      result.issues.push(`${clarifications} unresolved clarification(s)`);
    result.issues.push(
      ...physicalFieldIssues(record.checks ?? [], record.fieldVisits ?? []),
    );
    result.ready = result.issues.length === 0;
  }
  return result;
}

export async function assertCaseEvidenceReady(
  tx: Prisma.TransactionClient,
  caseId: bigint,
  options: { includeWork?: boolean } = {},
) {
  const result = await caseEvidenceReadiness(tx, caseId, options);
  if (!result.ready)
    throw new BadRequestException(
      `Evidence is not ready: ${result.issues.join("; ")}`,
    );
  return result;
}
