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
  const priorityCap = draft.priority === "Critical" ? 24 : draft.priority === "Priority" ? 48 : 120;
  return Math.max(...selected.map((pkg) => Math.min(pkg!.tatHours, priorityCap)));
}
