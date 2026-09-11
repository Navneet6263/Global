import { CheckCircle2, Clock3, Layers3, ShieldCheck } from "lucide-react";

import type { CaseServiceScope } from "@/lib/backend-api/case-services";
import { humanize } from "./case-detail-formatting";
import { Panel } from "./case-detail-ui";

const familyStyle: Record<string, string> = {
  HIRECHECK: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  INTEGRITYCHECK: "border-violet-200 bg-violet-50/70 text-violet-900",
  LEADERCHECK: "border-amber-200 bg-amber-50/70 text-amber-900",
  VENDORCHECK: "border-sky-200 bg-sky-50/70 text-sky-900",
};

const familyName: Record<string, string> = {
  HIRECHECK: "HireCheck",
  INTEGRITYCHECK: "IntegrityCheck",
  LEADERCHECK: "LeaderCheck",
  VENDORCHECK: "VendorCheck",
};

export function CaseServiceScopePanel({ services }: { services?: CaseServiceScope[] }) {
  if (!services?.length) return null;

  return (
    <Panel
      title="Service scope"
      subtitle="Selected services, evidence requirements and check progress"
    >
      <div className="grid gap-3 md:grid-cols-2">
        {services.map((service) => {
          const completed = service.checks.filter((check) => check.status === "COMPLETED").length;
          const progress = service.checks.length
            ? Math.round((completed / service.checks.length) * 100)
            : 0;
          return (
            <article
              key={service.publicId}
              className={`rounded-2xl border p-4 ${familyStyle[service.serviceFamily] ?? "border-border bg-secondary/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                    <Layers3 className="size-3.5" aria-hidden />
                    {familyName[service.serviceFamily] ?? humanize(service.serviceFamily)}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold">{service.servicePackage.name}</h3>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/75 px-2 py-1 text-[11px]">
                  <Clock3 className="size-3" aria-hidden /> {service.tatHours}h TAT
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span>
                  {completed} of {service.checks.length} checks completed
                </span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80"
                role="progressbar"
                aria-label={`${service.servicePackage.name} checks complete`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="h-full rounded-full bg-current transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {service.checks.map((check) => (
                  <span
                    key={check.publicId}
                    className="flex items-center gap-1 rounded-lg bg-white/70 px-2 py-1 text-[11px]"
                    title={`${humanize(check.status)}${check.result ? ` · ${humanize(check.result)}` : ""}`}
                  >
                    {check.status === "COMPLETED" ? (
                      <CheckCircle2 className="size-3" aria-hidden />
                    ) : null}
                    {humanize(check.type)}
                  </span>
                ))}
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed opacity-80">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {service.requiredDocuments.length
                  ? `Required evidence: ${service.requiredDocuments.map(humanize).join(", ")}`
                  : "Evidence requirements follow the assigned checks."}
              </p>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
