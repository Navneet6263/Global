import { BadgeCheck, Clock3, FileText } from "lucide-react";

import type { CaseDraft } from "./model";
import type { CaseServicePackage } from "@/lib/api/cases";
import { estimatedServiceHours } from "./case-draft-policy";

export function ReviewStep({
  draft,
  packages,
}: {
  draft: CaseDraft;
  packages: CaseServicePackage[];
}) {
  const hours = estimatedServiceHours(draft, packages);
  const estimatedTat = hours === null ? "—" : hours % 24 === 0 ? `${hours / 24}d` : `${hours}h`;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-slate-900">Review your request</h3>
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: "Candidate", value: draft.candidate || "—" },
            { key: "Client", value: draft.client || "—" },
            { key: "Email", value: draft.email || "—" },
            { key: "Mobile", value: draft.phone ? `+91 ${draft.phone}` : "—" },
            { key: "Package", value: draft.packageName || "—" },
            { key: "Priority", value: draft.priority },
          ].map((item) => (
            <div key={item.key}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {item.key}
              </p>
              <p className="break-words text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-800">
          <BadgeCheck className="size-4" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{draft.checks.length}</p>
          <p className="text-[11px] opacity-70">selected checks</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Clock3 className="size-4 text-muted-foreground" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{estimatedTat}</p>
          <p className="text-[11px] text-muted-foreground">estimated turnaround</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <FileText className="size-4 text-muted-foreground" />
          <p className="mt-2 text-2xl font-semibold">Consent</p>
          <p className="text-[11px] text-muted-foreground">
            OTP delivery queued after case creation
          </p>
        </div>
      </div>
      <section className="rounded-xl border border-slate-200 p-4">
        <h4 className="text-xs font-bold">Checks included in this request</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {draft.checks.map((check, index) => (
            <span
              key={`${check}-${index}`}
              className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-800"
            >
              {check.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </section>
      <p className="text-[11px] text-muted-foreground">
        Estimate includes the selected client SLA, service TAT and priority. The final due date is
        confirmed when the case is created.
      </p>
    </div>
  );
}
