/**
 * Colour-code dispositions (mirrors backend/src/verification/dispositions.ts):
 * GREEN clear, RED major discrepancy, YELLOW minor discrepancy, AMBER insufficient / UTV,
 * BLUE verified verbally, CLIENT_REVIEW waiting for the client's decision.
 */
export const DISPOSITIONS = ["GREEN", "YELLOW", "RED", "AMBER", "BLUE", "CLIENT_REVIEW"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const dispositionMeta: Record<Disposition, { label: string; short: string; hint: string }> =
  {
    GREEN: { label: "Clear", short: "Clear", hint: "Verified, no discrepancy" },
    YELLOW: { label: "Minor discrepancy", short: "Minor", hint: "Small mismatch, not adverse" },
    RED: { label: "Major discrepancy", short: "Major", hint: "Adverse or material discrepancy" },
    AMBER: { label: "Insufficient / UTV", short: "UTV", hint: "Could not be verified" },
    BLUE: { label: "Verified verbally", short: "Verbal", hint: "Confirmed verbally by the source" },
    CLIENT_REVIEW: {
      label: "Client review",
      short: "Client review",
      hint: "Needs the client's decision",
    },
  };

export const ALLOWED_BY_RESULT: Record<string, readonly Disposition[]> = {
  CLEAR: ["GREEN", "BLUE"],
  DISCREPANCY: ["RED", "YELLOW", "CLIENT_REVIEW"],
  UNABLE_TO_VERIFY: ["AMBER", "CLIENT_REVIEW"],
};

const DEFAULT: Record<string, Disposition> = {
  CLEAR: "GREEN",
  DISCREPANCY: "RED",
  UNABLE_TO_VERIFY: "AMBER",
};
const SEVERITY: Record<Disposition, number> = {
  RED: 5,
  CLIENT_REVIEW: 4,
  AMBER: 3,
  YELLOW: 2,
  BLUE: 1,
  GREEN: 0,
};

export function effectiveDisposition(check: {
  result?: string | null;
  disposition?: string | null;
}) {
  const stored = check.disposition as Disposition | null | undefined;
  if (stored && stored in dispositionMeta) return stored;
  return check.result ? (DEFAULT[check.result] ?? null) : null;
}

/** The case takes the colour of its most serious check; null until a result exists. */
export function caseColour(checks: Array<{ result?: string | null; disposition?: string | null }>) {
  let worst: Disposition | null = null;
  for (const check of checks) {
    const value = effectiveDisposition(check);
    if (value && (worst === null || SEVERITY[value] > SEVERITY[worst])) worst = value;
  }
  return worst;
}

/** CSS hook: `.colour-chip.is-green` etc. */
export const colourClass = (value: Disposition) => `is-${value.toLowerCase().replace("_", "-")}`;
