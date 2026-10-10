import { useQuery } from "@tanstack/react-query";
import { checkEvidenceApi } from "@/lib/backend-api/check-evidence";
import { getVerifiedDetails } from "@/lib/backend-api/verified-details";

/** Same minimum as the backend (check-readiness.ts). */
export const MIN_SUMMARY = 20;

export type StepId = "details" | "proof" | "outcome" | "review";

/**
 * Whether the verified details and proof are in place, from the same queries the
 * details form and proof panel use (so saving there updates the steps at once).
 */
export function useCheckReadiness(checkId: string, vendorApproved: boolean, enabled = true) {
  const details = useQuery({
    queryKey: ["checks", checkId, "verified-details"],
    queryFn: () => getVerifiedDetails(checkId),
    enabled,
  });
  const proof = useQuery({
    queryKey: ["check-evidence", checkId],
    queryFn: () => checkEvidenceApi.list(checkId),
    enabled,
  });
  const required = details.data?.rhs?.form?.fields?.filter((field) => field.required) ?? [];
  const entries = details.data?.rhs?.entries ?? [];
  const missingFields = entries.flatMap((entry) =>
    required.filter((field) => !entry[field.key]?.trim()).map((field) => field.label),
  );
  return {
    loading: details.isPending || proof.isPending,
    detailsDone: entries.length > 0 && missingFields.length === 0,
    detailsHint: !entries.length
      ? "Not saved yet"
      : missingFields.length
        ? `Missing: ${[...new Set(missingFields)].slice(0, 2).join(", ")}`
        : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} saved`,
    proofCount: proof.data?.items?.length ?? 0,
    proofDone: (proof.data?.items?.length ?? 0) > 0 || vendorApproved,
    vendorApproved,
  };
}
