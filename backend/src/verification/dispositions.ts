import { BadRequestException } from "@nestjs/common";

/**
 * Colour-code dispositions from the BGV process document:
 * GREEN clear, RED major discrepancy/adverse, YELLOW minor discrepancy,
 * AMBER insufficient/unable to verify, BLUE verified verbally, CLIENT_REVIEW for client decision.
 */
export const Dispositions = [
  "GREEN",
  "RED",
  "YELLOW",
  "AMBER",
  "BLUE",
  "CLIENT_REVIEW",
] as const;
export type Disposition = (typeof Dispositions)[number];

const ALLOWED: Record<string, readonly Disposition[]> = {
  CLEAR: ["GREEN", "BLUE"],
  DISCREPANCY: ["RED", "YELLOW", "CLIENT_REVIEW"],
  UNABLE_TO_VERIFY: ["AMBER", "CLIENT_REVIEW"],
};

const DEFAULT: Record<string, Disposition> = {
  CLEAR: "GREEN",
  DISCREPANCY: "RED",
  UNABLE_TO_VERIFY: "AMBER",
};

/** Worst first: a case takes the colour of its most serious check. */
const SEVERITY: Record<Disposition, number> = {
  RED: 5,
  CLIENT_REVIEW: 4,
  AMBER: 3,
  YELLOW: 2,
  BLUE: 1,
  GREEN: 0,
};

export function defaultDisposition(result?: string | null): Disposition | null {
  return result ? (DEFAULT[result] ?? null) : null;
}

/** The disposition to store for a completed check; rejects a colour that contradicts the result. */
export function resolveDisposition(
  result: string | undefined,
  requested?: string | null,
) {
  if (!result) return null;
  if (!requested) return defaultDisposition(result);
  const allowed = ALLOWED[result] ?? [];
  if (!allowed.includes(requested as Disposition))
    throw new BadRequestException(
      `${requested.replaceAll("_", " ").toLowerCase()} does not match a ${result.replaceAll("_", " ").toLowerCase()} result`,
    );
  return requested as Disposition;
}

export function effectiveDisposition(check: {
  result?: string | null;
  disposition?: string | null;
}) {
  return (
    (check.disposition as Disposition | null | undefined) ??
    defaultDisposition(check.result)
  );
}

/** Case colour from its checks; null while no check has a recorded result. */
export function caseColour(
  checks: Array<{ result?: string | null; disposition?: string | null }>,
) {
  let worst: Disposition | null = null;
  for (const check of checks) {
    const value = effectiveDisposition(check);
    if (value && (worst === null || SEVERITY[value] > SEVERITY[worst]))
      worst = value;
  }
  return worst;
}

export const DispositionLabels: Record<Disposition, string> = {
  GREEN: "Clear",
  RED: "Major discrepancy",
  YELLOW: "Minor discrepancy",
  AMBER: "Insufficient / UTV",
  BLUE: "Verified verbally",
  CLIENT_REVIEW: "Client review",
};
