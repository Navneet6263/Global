import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { assertMethodEvidenceCurrent } from "./method-evidence.policy";

export function consolidatedMethodResult(results: readonly (string | null)[]) {
  if (results.includes("DISCREPANCY")) return "DISCREPANCY";
  if (results.includes("UNABLE_TO_VERIFY")) return "UNABLE_TO_VERIFY";
  return "CLEAR";
}

export function assertMethodResults(
  runs: Array<{ status: string; result: string | null }>,
  result?: string,
) {
  if (runs.some((run) => run.status !== "RESPONDED" || !run.result)) {
    throw new BadRequestException(
      "Complete the outstanding source-method responses before completing this check",
    );
  }
  if (
    runs.length &&
    consolidatedMethodResult(runs.map((run) => run.result)) !== result
  ) {
    throw new BadRequestException(
      "The final outcome must reflect the recorded source results; resolve discrepancies before changing it",
    );
  }
}

export function assertAdverseMethodClarified(
  result: string | undefined,
  clarified: boolean,
) {
  if (result && result !== "CLEAR" && !clarified)
    throw new BadRequestException(
      "Record a clarification for this check and re-verify the corrected evidence before finalising an adverse or inconclusive outcome",
    );
}

export async function assertMethodOutcomesReady(
  tx: Prisma.TransactionClient,
  checkId: bigint,
  result?: string,
) {
  const runs = await tx.verificationMethodRun.findMany({
    where: { checkId, status: { not: "SUPERSEDED" } },
    select: {
      status: true,
      result: true,
      evidenceJson: true,
      respondedAt: true,
    },
  });
  assertMethodResults(runs, result);
  await assertMethodEvidenceCurrent(tx, checkId, runs);
  if (result && result !== "CLEAR") {
    const check = await tx.caseCheck.findUniqueOrThrow({
      where: { id: checkId },
      select: { caseId: true, reviewCycle: true },
    });
    const clarified = await tx.clarification.count({
      where: {
        caseId: check.caseId,
        checkId,
        status: "RESOLVED",
        reverificationRequired: true,
        OR: [
          { checkCycle: check.reviewCycle },
          ...(check.reviewCycle === 1 ? [{ checkCycle: null }] : []),
        ],
      },
    });
    assertAdverseMethodClarified(result, clarified > 0);
  }
}
