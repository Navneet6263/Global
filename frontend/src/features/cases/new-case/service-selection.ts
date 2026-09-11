import type { CaseServicePackage } from "@/lib/backend-api/cases";
import type { CaseDraft } from "./model";

export function serviceSelectionError(draft: CaseDraft, packages: CaseServicePackage[]) {
  const selections = draft.services?.length
    ? draft.services
    : draft.servicePackageId
      ? [{ servicePackageId: draft.servicePackageId }]
      : [];
  if (!selections.length || !draft.checks.length) return "Choose at least one service package";
  if (
    selections.length > 4 ||
    new Set(selections.map((item) => item.servicePackageId)).size !== selections.length
  ) {
    return "Choose up to four different service packages";
  }
  for (const selection of selections) {
    const pkg = packages.find((item) => item.id === selection.servicePackageId);
    if (!pkg) return "A selected package is no longer available. Choose your services again.";
    if (
      pkg.serviceFamily === "VENDORCHECK" &&
      (!selection.details?.["organisationName"]?.trim() ||
        !selection.details?.["registrationNumber"]?.trim())
    ) {
      return `${pkg.name}: enter the registered business name and registration number`;
    }
    if (
      selection.details?.["gstin"] &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
        selection.details["gstin"].trim().toUpperCase(),
      )
    ) {
      return `${pkg.name}: enter a valid 15-character GSTIN or leave it empty`;
    }
  }
  return undefined;
}
