import type { Prisma } from "../generated/prisma/client";

const LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function aggregateCheckRisk(
  checks: Array<{ riskLevel: string | null; result: string | null }>,
) {
  const levels = checks.map(
    (check) => check.riskLevel ?? (check.result === "CLEAR" ? "LOW" : null),
  );
  const rank = Math.max(
    -1,
    ...levels.map((level) => LEVELS.indexOf(level ?? "")),
  );
  if (
    rank <= 0 &&
    checks.some(
      (check) => check.result && check.result !== "CLEAR" && !check.riskLevel,
    )
  )
    return null;
  return rank < 0 ? null : LEVELS[rank]!;
}

export async function updateCaseRisk(
  tx: Prisma.TransactionClient,
  caseId: bigint,
) {
  const checks = await tx.caseCheck.findMany({
    where: { caseId },
    select: { riskLevel: true, result: true },
  });
  const riskLevel = aggregateCheckRisk(checks);
  await tx.verificationCase.update({
    where: { id: caseId },
    data: { riskLevel },
  });
  return riskLevel;
}
