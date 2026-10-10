import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { cleanVerified } from "./verified-fields";

/** A source summary shorter than this is not a factual account of the check. */
export const MIN_SOURCE_SUMMARY = 20;

const entriesOf = (json: string | null): Array<Record<string, unknown>> => {
  try {
    const parsed = JSON.parse(json ?? "") as { entries?: unknown };
    return Array.isArray(parsed.entries)
      ? parsed.entries.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === "object",
        )
      : [];
  } catch {
    return [];
  }
};

/**
 * What is still missing before a verifier may complete a check: the verified details
 * (every required field of the check's form), at least one proof file (or an approved
 * vendor result with its evidence) and a factual source summary. Empty when ready.
 */
export async function checkReadinessGaps(
  tx: Pick<Prisma.TransactionClient, "caseCheck">,
  check: { id: bigint; type: string },
  sourceSummary: string | undefined,
): Promise<string[]> {
  const row = await tx.caseCheck.findUniqueOrThrow({
    where: { id: check.id },
    select: {
      verifiedJson: true,
      _count: { select: { evidence: true } },
      vendorWork: {
        where: { status: "APPROVED" },
        select: { id: true },
        take: 1,
      },
    },
  });
  const gaps: string[] = [];
  const entries = entriesOf(row.verifiedJson);
  if (!entries.length)
    gaps.push("Save the verified details (what the source confirmed)");
  else
    try {
      cleanVerified(check.type, entries);
    } catch (error) {
      gaps.push(
        `Verified details are incomplete: ${error instanceof Error ? error.message : "check the required fields"}`,
      );
    }
  if (!row._count.evidence && !row.vendorWork.length)
    gaps.push(
      "Add at least one proof file (portal screenshot, email reply or report)",
    );
  if ((sourceSummary?.trim().length ?? 0) < MIN_SOURCE_SUMMARY)
    gaps.push(
      `Write a source summary of at least ${MIN_SOURCE_SUMMARY} characters`,
    );
  return gaps;
}

export async function assertCheckReady(
  tx: Pick<Prisma.TransactionClient, "caseCheck">,
  check: { id: bigint; type: string },
  sourceSummary: string | undefined,
) {
  const gaps = await checkReadinessGaps(tx, check, sourceSummary);
  if (gaps.length)
    throw new BadRequestException(
      `This check cannot be completed yet. ${gaps.map((gap, index) => `${index + 1}) ${gap}.`).join(" ")}`,
    );
}
