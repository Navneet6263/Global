import type { CaseServicePackage } from "@/lib/backend-api/cases";
import type { CaseDraft } from "./model";

export function updateCaseDraft(current: CaseDraft, patch: Partial<CaseDraft>): CaseDraft {
  const next = { ...current, ...patch };
  if (patch.clientId === undefined || patch.clientId === current.clientId) return next;
  return {
    ...next,
    servicePackageId: "",
    services: [],
    packageName: "",
    packageTatHours: 0,
    checks: [],
  };
}

/** The longest agreed TAT of the chosen packages; priority orders the queue, not the TAT. */
export function estimatedServiceHours(draft: CaseDraft, packages: CaseServicePackage[]) {
  const selectedIds = draft.services?.length
    ? draft.services.map((service) => service.servicePackageId)
    : [draft.servicePackageId];
  const selected = selectedIds.map((id) => packages.find((pkg) => pkg.id === id));
  if (
    !selected.length ||
    selected.some((pkg) => !pkg || !Number.isFinite(pkg.tatHours) || pkg.tatHours <= 0)
  )
    return null;
  return Math.max(...selected.map((pkg) => pkg!.tatHours));
}
