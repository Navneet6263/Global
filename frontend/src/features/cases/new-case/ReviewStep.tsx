import { BadgeCheck, Clock3, FileText } from "lucide-react";

import { estimatedTatDays, type CaseDraft } from "./model";

export function ReviewStep({ draft }: { draft: CaseDraft }) {
  const estimatedTat = estimatedTatDays(draft.packageTatHours, draft.priority);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-secondary/70 p-4">
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
              <p className="truncate text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
          <BadgeCheck className="size-4" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{draft.checks.length}</p>
          <p className="text-[11px] opacity-70">package checks</p>
        </div>
        <div className="rounded-2xl bg-secondary/70 p-4">
          <Clock3 className="size-4 text-muted-foreground" />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{estimatedTat}d</p>
          <p className="text-[11px] text-muted-foreground">committed package TAT</p>
        </div>
        <div className="rounded-2xl bg-secondary/70 p-4">
          <FileText className="size-4 text-muted-foreground" />
          <p className="mt-2 text-2xl font-semibold">Consent</p>
          <p className="text-[11px] text-muted-foreground">
            OTP delivery queued after case creation
          </p>
        </div>
      </div>
    </div>
  );
}
