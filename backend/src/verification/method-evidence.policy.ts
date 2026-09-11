import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";

export type MethodEvidence = { documentId: string; version: number | null };
export type MethodEvidenceDocument = {
  publicId: string;
  status: string;
  currentVersion: number;
  expiresAt: Date | null;
  versions: Array<{ version: number; createdAt: Date }>;
};
export const methodEvidenceSelect = {
  publicId: true,
  status: true,
  currentVersion: true,
  expiresAt: true,
  versions: {
    orderBy: { version: "desc" },
    take: 1,
    select: { version: true, createdAt: true },
  },
} as const;

export function parseMethodEvidence(value: string): MethodEvidence[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("Invalid evidence");
    const evidence = parsed.map((item: unknown) => {
      if (typeof item === "string" && item.length)
        return { documentId: item, version: null };
      if (!item || typeof item !== "object")
        throw new Error("Invalid evidence");
      const entry = item as Record<string, unknown>;
      if (
        typeof entry.documentId !== "string" ||
        !entry.documentId.length ||
        typeof entry.version !== "number" ||
        !Number.isSafeInteger(entry.version) ||
        entry.version < 1
      ) {
        throw new Error("Invalid evidence");
      }
      return { documentId: entry.documentId, version: entry.version };
    });
    if (
      new Set(evidence.map((entry) => entry.documentId)).size !==
      evidence.length
    )
      throw new Error("Repeated evidence");
    return evidence;
  } catch {
    throw new BadRequestException(
      "Source evidence record is invalid; request controlled re-verification",
    );
  }
}

export async function captureMethodEvidence(
  tx: Prisma.TransactionClient,
  caseId: bigint,
  ids: string[],
  expected?: Array<{ documentId: string; version: number }>,
) {
  if (
    expected &&
    (expected.length !== ids.length ||
      new Set(expected.map((item) => item.documentId)).size !== ids.length ||
      expected.some((item) => !ids.includes(item.documentId)))
  ) {
    throw new BadRequestException(
      "Select the exact reviewed version of every evidence document",
    );
  }
  if (!ids.length) return [];
  const today = new Date(new Date().toISOString().slice(0, 10));
  const documents = await tx.document.findMany({
    where: {
      caseId,
      publicId: { in: ids },
      status: "VERIFIED",
      currentVersion: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
    },
    select: { publicId: true, currentVersion: true },
  });
  if (documents.length !== ids.length) {
    throw new BadRequestException(
      "Every evidence document must belong to this case, be reviewed and unexpired",
    );
  }
  if (
    expected &&
    documents.some(
      (doc) =>
        expected.find((item) => item.documentId === doc.publicId)?.version !==
        doc.currentVersion,
    )
  ) {
    throw new ConflictException(
      "An evidence file changed after you opened it. Refresh and review the latest version before responding.",
    );
  }
  return documents.map((doc) => ({
    documentId: doc.publicId,
    version: doc.currentVersion,
  }));
}

export async function assertMethodEvidenceCurrent(
  tx: Prisma.TransactionClient,
  checkId: bigint,
  runs: Array<{ evidenceJson: string; respondedAt: Date | null }>,
) {
  const snapshots = runs.map((run) => ({
    ...run,
    evidence: parseMethodEvidence(run.evidenceJson),
  }));
  const ids = [
    ...new Set(
      snapshots.flatMap((run) => run.evidence.map((entry) => entry.documentId)),
    ),
  ];
  if (!ids.length) return;
  const check = await tx.caseCheck.findUniqueOrThrow({
    where: { id: checkId },
    select: { caseId: true },
  });
  const documents = await tx.document.findMany({
    where: { caseId: check.caseId, publicId: { in: ids } },
    select: methodEvidenceSelect,
  });
  validateMethodEvidence(
    runs,
    new Map(documents.map((doc) => [doc.publicId, doc])),
  );
}

export function validateMethodEvidence(
  runs: Array<{ evidenceJson: string; respondedAt: Date | null }>,
  byId: ReadonlyMap<string, MethodEvidenceDocument>,
  now = new Date(),
) {
  const snapshots = runs.map((run) => ({
    ...run,
    evidence: parseMethodEvidence(run.evidenceJson),
  }));
  const today = new Date(now.toISOString().slice(0, 10));
  for (const run of snapshots) {
    for (const entry of run.evidence) {
      const doc = byId.get(entry.documentId);
      const latest = doc?.versions[0];
      const exactVersion =
        entry.version !== null
          ? doc?.currentVersion === entry.version
          : Boolean(
              run.respondedAt && latest && latest.createdAt <= run.respondedAt,
            );
      if (
        !doc ||
        doc.status !== "VERIFIED" ||
        !latest ||
        latest.version !== doc.currentVersion ||
        !exactVersion ||
        (doc.expiresAt && doc.expiresAt < today)
      ) {
        throw new BadRequestException(
          "Source evidence changed, expired or needs review; clarify and re-verify the affected check",
        );
      }
    }
  }
}
