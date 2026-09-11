import { Check, Clock3, PackageCheck } from "lucide-react";

import type { CaseServicePackage } from "@/lib/api/cases";
import { checkCatalog, type CaseDraft, type CheckKey } from "./model";
import { ServiceDetailsFields } from "./ServiceDetailsFields";
import { serviceSelectionError } from "./service-selection";

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
  const selectedServices = draft.services?.length
    ? draft.services
    : draft.servicePackageId
      ? [{ servicePackageId: draft.servicePackageId }]
      : [];
  const selectPackage = (servicePackage: CaseServicePackage) => {
    const selected = selectedServices.some(
      (service) => service.servicePackageId === servicePackage.id,
    );
    const services = selected
      ? selectedServices.filter((service) => service.servicePackageId !== servicePackage.id)
      : [...selectedServices, { servicePackageId: servicePackage.id }];
    if (services.length > 4) return;
    const selectedPackages = services.map((service) =>
      packages.find((pkg) => pkg.id === service.servicePackageId)!,
    );
    onChange({
      services,
      servicePackageId: services[0]?.servicePackageId ?? "",
      packageName: selectedPackages.map((pkg) => pkg.name).join(" + "),
      packageTatHours: Math.max(0, ...selectedPackages.map((pkg) => pkg.tatHours)),
      checks: selectedPackages.flatMap((pkg) => pkg.checks) as CheckKey[],
    });
  };

  if (loading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2" aria-label="Loading service packages">
        {[0, 1].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl bg-secondary/70" />
        ))}
      </div>
    );
  }

  if (error || packages.length === 0) {
    return (
      <div className="rounded-2xl border border-warning/20 bg-warning-soft p-5">
        <p className="text-sm font-semibold">No active service package is available</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {error ?? "Ask the Platform Admin to publish a package before initiating a case."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Choose up to four services. Each service keeps its own checks, requirements and review
        history.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {packages.map((item) => {
          const selected = selectedServices.some((service) => service.servicePackageId === item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              disabled={!selected && selectedServices.length >= 4}
              onClick={() => selectPackage(item)}
              className={`rounded-2xl p-4 text-left transition-colors ${
                selected ? "bg-accent text-accent-foreground" : "bg-secondary/70 hover:bg-secondary"
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="mt-1 block text-[11px] opacity-70">
                    {item.code} · {item.checks.length} checks
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[11px] opacity-75">
                  <Clock3 className="size-3" /> {formatTat(item.tatHours)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {draft.servicePackageId ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Package checks ({draft.checks.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {draft.checks.map((key, index) => {
              const item = checkCatalog.find((candidate) => candidate.key === key);
              const Icon = item?.icon ?? PackageCheck;
              return (
                <div
                  key={`${key}-${index}`}
                  className="flex items-center gap-3 rounded-2xl bg-secondary/65 px-3 py-2.5"
                >
                  <span className="grid size-8 place-items-center rounded-full bg-card text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item?.label ?? key.replaceAll("_", " ")}
                  </span>
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
            Checks are controlled by the selected service package and recorded with the case.
          </p>
          {draft.checks.includes("ADDRESS") ? (
            <p className="mt-3 rounded-xl border border-warning/25 bg-warning-soft/60 p-3 text-xs leading-relaxed">
              Physical address visit required. Operations must assign a Field Executive; completed
              field evidence must receive supervisor approval before this case can enter QA.
            </p>
          ) : null}
        </div>
      ) : null}
      {selectedServices.map((service) => {
        const pkg = packages.find((item) => item.id === service.servicePackageId);
        return pkg ? (
          <ServiceDetailsFields
            key={pkg.id}
            pkg={pkg}
            details={service.details ?? {}}
            onChange={(details) =>
              onChange({
                services: selectedServices.map((item) =>
                  item.servicePackageId === pkg.id ? { ...item, details } : item,
                ),
              })
            }
          />
        ) : null;
      })}
      {selectedServices.length > 0 && serviceSelectionError(draft, packages) && (
        <p role="status" className="text-xs text-amber-800">
          {serviceSelectionError(draft, packages)}
        </p>
      )}
    </div>
  );
}

function formatTat(hours: number) {
  return hours % 24 === 0 ? `${hours / 24}d TAT` : `${hours}h TAT`;
}
