import type { CaseServicePackage } from "@/lib/api/cases";
import type { CaseDraft } from "./model";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Price for the checks actually chosen, with the same rule as the server: every check
 * costs the package price; fewer checks cost the sum of their own prices, never more
 * than the package.
 */
export function servicePrice(pkg: CaseServicePackage, selectedChecks?: readonly string[]) {
  const full = Number(pkg.price);
  const checks = pkg.checks ?? [];
  if (!selectedChecks || !pkg.checkPrices || checks.every((c) => selectedChecks.includes(c)))
    return full;
  const prices = pkg.checkPrices;
  return Math.min(
    full,
    round(selectedChecks.reduce((sum, check) => sum + Number(prices[check] ?? 0), 0)),
  );
}

export function casePriceEstimate(draft: CaseDraft, packages: CaseServicePackage[]) {
  const picks = draft.services?.length
    ? draft.services.map((item) => ({ id: item.servicePackageId, checks: item.selectedChecks }))
    : [draft.servicePackageId].filter(Boolean).map((id) => ({ id, checks: undefined }));
  const lines = picks.map((pick) => {
    const pkg = packages.find((item) => item.id === pick.id);
    return {
      pkg,
      selectedCount: pick.checks?.length ?? pkg?.checks?.length ?? 0,
      totalCount: pkg?.checks?.length ?? 0,
      price:
        pkg && pkg.price != null && Number.isFinite(Number(pkg.price))
          ? servicePrice(pkg, pick.checks)
          : null,
    };
  });
  const selected = lines.map((line) => line.pkg);
  const known =
    lines.length > 0 &&
    lines.every(
      (line) =>
        line.pkg &&
        line.price !== null &&
        line.price >= 0 &&
        line.pkg.taxRate != null &&
        Number.isFinite(Number(line.pkg.taxRate)) &&
        Number(line.pkg.taxRate) >= 0,
    );
  const subtotal = known ? round(lines.reduce((sum, line) => sum + line.price!, 0)) : null;
  const tax = known
    ? round(
        lines.reduce(
          (sum, line) => sum + round((line.price! * Number(line.pkg!.taxRate)) / 100),
          0,
        ),
      )
    : null;
  return {
    selected,
    lines,
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
