import { caseDocumentRequirements } from "../cases/check-requirements";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { requiredDocumentTypes } from "../documents/evidence-readiness";

/**
 * Where each check stands on its own documents, so Data Entry can work check by check:
 * ACCEPTED (its form opens and it can go to its team), TO_REVIEW (Data Entry must accept
 * or reject a document first) or WAITING_CANDIDATE (missing or rejected; the candidate
 * uploads again).
 */
export type CheckDocumentState = "ACCEPTED" | "TO_REVIEW" | "WAITING_CANDIDATE";

type StateDocument = {
  type: string;
  status: string;
  currentVersion: number;
  expiresAt?: Date | null;
  createdAt?: Date;
};

const SENT_BACK = ["REJECTED", "REUPLOAD_REQUIRED"];

function latestByType(documents: readonly StateDocument[]) {
  const latest = new Map<string, StateDocument>();
  for (const doc of documents) {
    const previous = latest.get(doc.type);
    if (
      !previous ||
      (doc.createdAt?.getTime() ?? 0) >= (previous.createdAt?.getTime() ?? 0)
    )
      latest.set(doc.type, doc);
  }
  return latest;
}

export function checkDocumentStates<T extends { type: string }>(
  requiredDocuments: readonly string[],
  checks: readonly T[],
  documents: readonly StateDocument[],
  now = new Date(),
) {
  const latest = latestByType(documents);
  const requirements = caseDocumentRequirements(
    requiredDocuments,
    checks.map((check) => check.type),
  );
  return checks.map((check) => {
    const types = requirements
      .filter((row) => row.checks.includes(check.type))
      .map((row) => row.type);
    const waiting: string[] = [];
    const toReview: string[] = [];
    for (const type of types) {
      const doc = latest.get(type);
      const expired = Boolean(doc?.expiresAt && doc.expiresAt < now);
      if (
        !doc ||
        doc.currentVersion <= 0 ||
        SENT_BACK.includes(doc.status) ||
        expired
      )
        waiting.push(type);
      else if (doc.status !== "VERIFIED") toReview.push(type);
    }
    const state: CheckDocumentState = waiting.length
      ? "WAITING_CANDIDATE"
      : toReview.length
        ? "TO_REVIEW"
        : "ACCEPTED";
    return { check, documents: types, state, waiting, toReview };
  });
}

/** Uploaded documents nobody has accepted or rejected yet. */
export function unreviewedDocuments(documents: readonly StateDocument[]) {
  return [...latestByType(documents).values()]
    .filter(
      (doc) =>
        doc.currentVersion > 0 &&
        doc.status !== "VERIFIED" &&
        !SENT_BACK.includes(doc.status),
    )
    .map((doc) => doc.type);
}

/** Loads a case's checks, documents and requirements and works out each check's state. */
export async function loadCheckDocumentStates(
  prisma: Pick<PrismaService, "caseCheck" | "document" | "caseService">,
  caseId: bigint,
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  const [checks, documents, services] = await Promise.all([
    client.caseCheck.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        publicId: true,
        type: true,
        status: true,
        departmentId: true,
        initiatedAt: true,
        tasks: {
          where: {
            status: { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] },
          },
          select: { id: true },
        },
      },
    }),
    client.document.findMany({
      where: { caseId },
      select: {
        type: true,
        status: true,
        currentVersion: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    client.caseService.findMany({
      where: { caseId },
      select: { requiredDocumentsJson: true },
    }),
  ]);
  const required = [
    ...new Set(
      services.flatMap((service) =>
        requiredDocumentTypes(service.requiredDocumentsJson),
      ),
    ),
  ];
  return {
    states: checkDocumentStates(required, checks, documents),
    unreviewed: unreviewedDocuments(documents),
    documents,
  };
}
