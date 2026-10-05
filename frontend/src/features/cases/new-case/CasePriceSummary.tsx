import type { CaseServicePackage } from "@/lib/api/cases";
import type { CaseDraft } from "./model";
import { casePriceEstimate, priceLabel } from "./case-price-estimate";

export function CasePriceSummary({
  draft,
  packages,
}: {
  draft: CaseDraft;
  packages: CaseServicePackage[];
}) {
  const estimate = casePriceEstimate(draft, packages);
  return (
    <section
      aria-label="Price estimate"
      className="rounded-xl border border-blue-100 bg-blue-50/50 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Your estimate</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">INR</span>
      </div>
      <div className="mt-3 space-y-2">
        {estimate.selected
          .filter((pkg): pkg is CaseServicePackage => Boolean(pkg))
          .map((pkg) => (
            <div key={pkg.id} className="flex justify-between gap-3 text-xs">
              <span className="text-slate-600">{pkg.name}</span>
              <strong className="whitespace-nowrap text-slate-800">
                {pkg.price != null ? priceLabel(Number(pkg.price)) : "Not available"}
              </strong>
            </div>
          ))}
        {!estimate.selected.length && (
          <p className="text-xs leading-5 text-slate-500">
            Select a package to see the agreed rate and tax.
          </p>
        )}
      </div>
      {estimate.total !== null ? (
        <dl className="mt-3 space-y-2 border-t border-blue-100 pt-3 text-xs">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{priceLabel(estimate.subtotal!)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd>{priceLabel(estimate.tax!)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-sm font-bold text-blue-800">
            <dt>Estimated total</dt>
            <dd>{priceLabel(estimate.total)}</dd>
          </div>
        </dl>
      ) : estimate.selected.length > 0 ? (
        <p className="mt-3 text-xs font-medium text-amber-800">
          Price or tax not available. Confirm charges with your account manager.
        </p>
      ) : null}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        Package pricing applies even when you select fewer checks. Final charges follow your
        agreement; creating a case does not collect a payment.
      </p>
    </section>
  );
}
