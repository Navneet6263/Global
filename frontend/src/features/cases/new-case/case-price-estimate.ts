import type { CaseServicePackage } from "@/lib/api/cases";
import type { CaseDraft } from "./model";

export function casePriceEstimate(draft: CaseDraft, packages: CaseServicePackage[]) {
  const ids = draft.services?.length
    ? draft.services.map((item) => item.servicePackageId)
    : [draft.servicePackageId].filter(Boolean);
  const selected = ids.map((id) => packages.find((pkg) => pkg.id === id));
  const known =
    selected.length > 0 &&
    selected.every(
      (pkg) =>
        pkg &&
        pkg.price != null &&
        pkg.taxRate != null &&
        Number.isFinite(Number(pkg.price)) &&
        Number(pkg.price) >= 0 &&
        Number.isFinite(Number(pkg.taxRate)) &&
        Number(pkg.taxRate) >= 0,
    );
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = known ? round(selected.reduce((sum, pkg) => sum + Number(pkg!.price), 0)) : null;
  const tax = known
    ? round(
        selected.reduce(
          (sum, pkg) => sum + round((Number(pkg!.price) * Number(pkg!.taxRate)) / 100),
          0,
        ),
      )
    : null;
  return {
    selected,
    subtotal,
    tax,
    total: subtotal === null || tax === null ? null : round(subtotal + tax),
  };
}
export const priceLabel = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
