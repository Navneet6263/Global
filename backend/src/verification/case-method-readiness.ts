import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import {
  assertAdverseMethodClarified,
  assertMethodResults,
} from "./method-outcome.policy";
import {
  methodEvidenceSelect,
  validateMethodEvidence,
} from "./method-evidence.policy";

/** Final approvals retain the legacy no-run scope; fresh task completion uses
 * the single-check policy, including the adverse manual clarification gate. */
export async function caseMethodIssues(
  tx: Prisma.TransactionClient,
  caseId: bigint,
) {
  const checks = await tx.caseCheck.findMany({
    where: {
      caseId,
      status: "COMPLETED",
      methodRuns: { some: { status: { not: "SUPERSEDED" } } },
    },
    select: {
      id: true,
      type: true,
      result: true,
      reviewCycle: true,
      methodRuns: {
        where: { status: { not: "SUPERSEDED" } },
        select: {
          status: true,
          result: true,
          evidenceJson: true,
          respondedAt: true,
        },
      },
    },
  });
  if (!checks.length) return [];
  const adverseIds = checks
    .filter((check) => check.result && check.result !== "CLEAR")
    .map((check) => check.id);
  const hasEvidence = checks.some((check) =>
    check.methodRuns.some((run) => run.evidenceJson.trim() !== "[]"),
  );
  const [documents, clarifications] = await Promise.all([
    hasEvidence
      ? tx.document.findMany({
          where: { caseId },
          select: methodEvidenceSelect,
        })
      : Promise.resolve([]),
    adverseIds.length
      ? tx.clarification.findMany({
          where: {
            caseId,
            checkId: { in: adverseIds },
            status: "RESOLVED",
            reverificationRequired: true,
          },
          select: { checkId: true, checkCycle: true },
        })
      : Promise.resolve([]),
  ]);
  const documentsById = new Map(documents.map((doc) => [doc.publicId, doc]));
  const clarifiedCycles = new Set(
    clarifications.map((row) => `${row.checkId}:${row.checkCycle ?? 1}`),
  );
  const issues: string[] = [];
  for (const check of checks) {
    try {
      assertMethodResults(check.methodRuns, check.result ?? undefined);
      validateMethodEvidence(check.methodRuns, documentsById);
      assertAdverseMethodClarified(
        check.result ?? undefined,
        clarifiedCycles.has(`${check.id}:${check.reviewCycle}`),
      );
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      issues.push(`${check.type}: ${error.message}`);
    }
  }
  return issues;
}
