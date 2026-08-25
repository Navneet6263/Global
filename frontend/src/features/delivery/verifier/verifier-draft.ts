import type { FindingInput } from "@/lib/api/tasks";

export type VerifierResult = "CLEAR" | "DISCREPANCY" | "UNABLE_TO_VERIFY";

export function readVerifierDraft(
  key: string,
): { result: VerifierResult; sourceSummary: string; findings: FindingInput[] } | undefined {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}
