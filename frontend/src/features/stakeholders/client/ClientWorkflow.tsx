import {
  ArrowRight,
  CircleCheck,
  FileCheck2,
  ScanSearch,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import type { OperationsDashboard } from "@/lib/api/dashboards";

export function ClientWorkflow({ data }: { data: OperationsDashboard | undefined }) {
  const stages = [
    {
      label: "Intake & consent",
      hint: "Case setup",
      count: count(data, ["DRAFT", "CONSENT_PENDING"]),
      icon: UserCheck,
      tone: "blue",
    },
    {
      label: "Documents",
      hint: "Collection",
      count: count(data, ["DOCUMENT_PENDING"]),
      icon: FileCheck2,
      tone: "amber",
    },
    {
      label: "Verification",
      hint: "Checks running",
      count: count(data, ["READY", "IN_PROGRESS"]),
      icon: ScanSearch,
      tone: "blue",
    },
    {
      label: "Information needed",
      hint: "Client action",
      count: count(data, ["CLARIFICATION_PENDING"]),
      icon: CircleCheck,
      tone: "orange",
    },
    {
      label: "Quality review",
      hint: "Final review",
      count: count(data, ["QA_PENDING", "QA_REVIEW", "APPROVED"]),
      icon: ShieldCheck,
      tone: "violet",
    },
    {
      label: "Completed",
      hint: "Report ready",
      count: count(data, ["COMPLETED", "CLOSED"]),
      icon: CircleCheck,
      tone: "emerald",
    },
  ] as const;
  const activeTotal = stages.slice(0, 5).reduce((sum, stage) => sum + stage.count, 0);
  const bottleneck = stages
    .slice(0, 5)
    .reduce((largest, stage) => (stage.count > largest.count ? stage : largest));

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_16px_44px_-34px_rgba(15,23,42,0.45)]">
      <header className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Verification flow</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            See exactly where every active case is moving or waiting.
          </p>
        </div>
        <div className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-semibold text-slate-600">
          {activeTotal ? `${bottleneck.label} currently has the most work` : "No active bottleneck"}
        </div>
      </header>
      <div className="grid gap-2 p-4 md:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => (
          <div key={stage.label} className="relative flex min-w-0 items-center gap-3 xl:block">
            <article className="min-w-0 flex-1 rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${tones[stage.tone]}`}>
                  <stage.icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-xl font-semibold tracking-tight">{stage.count}</span>
              </div>
              <p className="mt-4 truncate text-[11px] font-semibold text-slate-800">
                {stage.label}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">{stage.hint}</p>
            </article>
            {index < stages.length - 1 ? (
              <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 xl:absolute xl:-right-[0.44rem] xl:top-1/2 xl:block xl:z-10" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function count(data: OperationsDashboard | undefined, statuses: string[]) {
  return statuses.reduce((sum, status) => sum + (data?.statusMix[status] ?? 0), 0);
}

const tones = {
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  orange: "bg-orange-100 text-orange-700",
  violet: "bg-violet-100 text-violet-700",
  emerald: "bg-emerald-100 text-emerald-700",
} as const;
