import { Check, Clock3, PackageCheck } from "lucide-react";
import type { CaseServicePackage } from "@/lib/api/cases";
import { checkCatalog, type CaseDraft, type CheckKey, type ServiceSelection } from "./model";
import { ServiceDetailsFields } from "./ServiceDetailsFields";
import { serviceSelectionError } from "./service-selection";
import { priceLabel } from "./case-price-estimate";

export function ChecksStep({
  draft,
  packages,
  loading,
  error,
  onChange,
}: {
  draft: CaseDraft;
  packages: CaseServicePackage[];
  loading: boolean;
  error?: string;
  onChange: (patch: Partial<CaseDraft>) => void;
}) {
  const services: ServiceSelection[] = draft.services?.length
    ? draft.services
    : draft.servicePackageId
      ? [{ servicePackageId: draft.servicePackageId }]
      : [];
  const update = (next: ServiceSelection[]) => {
    const selected = next.map((service) =>
      packages.find((pkg) => pkg.id === service.servicePackageId),
    );
    onChange({
      services: next,
      servicePackageId: next[0]?.servicePackageId ?? "",
      packageName: selected.map((pkg) => pkg?.name ?? "Unavailable package").join(" + "),
      packageTatHours: Math.max(0, ...selected.map((pkg) => pkg?.tatHours ?? 0)),
      checks: next.flatMap(
        (service, index) => service.selectedChecks ?? selected[index]?.checks ?? [],
      ) as CheckKey[],
    });
  };
  if (loading)
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading service packages">
        {[0, 1].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  if (error || !packages.length)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold">No active service package is available</p>
        <p className="mt-2 text-xs text-slate-600">
          {error ?? "Ask your account manager to enable a service package for your organisation."}
        </p>
      </div>
    );
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-slate-900">Build your verification</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Choose up to four packages, then select the checks you need in each one.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {packages.map((pkg) => {
          const selected = services.some((service) => service.servicePackageId === pkg.id);
          return (
            <button
              key={pkg.id}
              type="button"
              aria-pressed={selected}
              disabled={!selected && services.length >= 4}
              onClick={() =>
                update(
                  selected
                    ? services.filter((service) => service.servicePackageId !== pkg.id)
                    : [...services, { servicePackageId: pkg.id, selectedChecks: [...pkg.checks] }],
                )
              }
              className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${selected ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-300" : "border-slate-200 bg-white hover:border-blue-300"}`}
            >
              <span className="flex items-center justify-between">
                <PackageCheck className="size-5 text-blue-600" />
                <span
                  className={`grid size-5 place-items-center rounded-full border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}
                >
                  {selected && <Check className="size-3" />}
                </span>
              </span>
              <strong className="mt-3 block text-sm text-slate-900">{pkg.name}</strong>
              <span className="mt-1 block text-xs text-slate-500">
                {pkg.checks.length} available checks
              </span>
              <span className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
                <span className="text-xs font-bold text-slate-800">
                  {pkg.price != null ? `${priceLabel(Number(pkg.price))} + tax` : "Rate on request"}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock3 className="size-3" />
                  {pkg.tatHours % 24 ? `${pkg.tatHours}h` : `${pkg.tatHours / 24}d`} TAT
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {services.map((service) => {
        const pkg = packages.find((item) => item.id === service.servicePackageId);
        if (!pkg) return null;
        const selected = service.selectedChecks ?? pkg.checks;
        return (
          <section
            key={pkg.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{pkg.name}</h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  {selected.length} of {pkg.checks.length} checks selected
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600"
                onClick={() =>
                  update(
                    services.map((item) =>
                      item.servicePackageId === pkg.id
                        ? { ...item, selectedChecks: [...pkg.checks] }
                        : item,
                    ),
                  )
                }
              >
                Select all
              </button>
            </header>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {pkg.checks.map((key) => {
                const check = checkCatalog.find((item) => item.key === key);
                const Icon = check?.icon ?? PackageCheck;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 ${selected.includes(key) ? "border-blue-100 bg-blue-50/40" : "border-slate-100"}`}
                  >
                    <input
                      aria-label={`${pkg.name}: ${check?.label ?? key}`}
                      type="checkbox"
                      checked={selected.includes(key)}
                      className="size-4 shrink-0 accent-blue-600"
                      onChange={(event) =>
                        update(
                          services.map((item) =>
                            item.servicePackageId === pkg.id
                              ? {
                                  ...item,
                                  selectedChecks: event.target.checked
                                    ? [...selected, key]
                                    : selected.filter((value) => value !== key),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <Icon className="size-4 shrink-0 text-blue-600" />
                    <span className="text-xs font-medium text-slate-700">
                      {check?.label ?? key.replaceAll("_", " ")}
                    </span>
                  </label>
                );
              })}
            </div>
            {pkg.requiredDocuments?.length ? (
              <p className="border-t border-slate-100 px-4 py-3 text-[11px] leading-5 text-slate-500">
                Package document requirements still apply:{" "}
                {pkg.requiredDocuments
                  .map((value) => value.replaceAll("_", " ").toLowerCase())
                  .join(", ")}
                .
              </p>
            ) : null}
            <div className="px-4 pb-3">
              <ServiceDetailsFields
                pkg={pkg}
                details={service.details ?? {}}
                onChange={(details) =>
                  update(
                    services.map((item) =>
                      item.servicePackageId === pkg.id ? { ...item, details } : item,
                    ),
                  )
                }
              />
            </div>
          </section>
        );
      })}
      {services.length > 0 && serviceSelectionError(draft, packages) && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {serviceSelectionError(draft, packages)}
        </p>
      )}
      <p className="text-[11px] leading-5 text-slate-500">
        Only selected checks are created. Assignment, required evidence and final release remain
        controlled by the verification team.
      </p>
    </div>
  );
}
