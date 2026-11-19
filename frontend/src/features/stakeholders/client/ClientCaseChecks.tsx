import { useState } from "react";
import { CheckCheck, ChevronDown } from "lucide-react";
import type { CaseDetail } from "@/lib/api/cases";
import { Card, CardHeader, Chip, Segmented } from "@/kit";
import { cn } from "@/lib/utils";
import { humanize, statusKind } from "./client-portal-utils";
import { caseDate } from "./client-case-activity";

type Filter = "All" | "Pending" | "Completed";

export function ClientCaseChecks({ checks }: { checks: CaseDetail["checks"] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const rows = checks.filter(
    (check) =>
      filter === "All" ||
      (filter === "Completed" ? check.status === "COMPLETED" : check.status !== "COMPLETED"),
  );
  return (
    <Card>
      <CardHeader
        title="Verification checks"
        count={checks.length}
        aside={
          <Segmented<Filter>
            label="Check filters"
            value={filter}
            onChange={setFilter}
            options={[
              ["All", "All"],
              ["Pending", "Pending"],
              ["Completed", "Completed"],
            ]}
          />
        }
      />
      <div className="divide-y divide-line">
        {rows.map((check) => {
          const done = check.status === "COMPLETED";
          return (
            <details key={check.publicId} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-subtle/60">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md",
                    done ? "bg-good-soft text-good" : "bg-brand-soft text-brand",
                  )}
                >
                  <CheckCheck className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{humanize(check.type)}</p>
                  <p className="text-xs text-dim">
                    {check.result ? humanize(check.result) : "Outcome not recorded yet"} · View
                    details
                  </p>
                </div>
                <Chip tone={statusKind(check.status)}>{humanize(check.status)}</Chip>
                <ChevronDown
                  className="size-4 text-dim transition group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <dl className="grid gap-3 border-t border-line bg-subtle/40 px-4 py-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-dim">Completed at</dt>
                  <dd className="mt-0.5 font-medium text-ink">{caseDate(check.completedAt)}</dd>
                </div>
              </dl>
            </details>
          );
        })}
      </div>
      {!rows.length ? (
        <p className="p-8 text-center text-sm text-dim">No checks in this view.</p>
      ) : null}
      <p className="border-t border-line px-4 py-3 text-xs text-dim">
        Individual outcomes are not a released final report.
      </p>
    </Card>
  );
}
