import { ChevronRight, ListChecks, MapPin } from "lucide-react";

import type { ApiFieldVisit } from "./types";

const stateTone: Record<string, string> = {
  ASSIGNED: "bg-info-soft text-info-foreground",
  IN_PROGRESS: "bg-review-soft text-review-foreground",
  COMPLETED: "bg-success-soft text-success-foreground",
  EXCEPTION_REVIEW: "bg-warning-soft text-warning-foreground",
};

export function FieldDayPlan({
  visits,
  activeId,
  onSelect,
}: {
  visits: ApiFieldVisit[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="surface rounded-[1.75rem] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-mint-soft text-mint-deep">
            <ListChecks className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Route queue</h2>
            <p className="text-[10px] text-muted-foreground">Select a visit to open its workflow</p>
          </div>
        </div>
        <span className="num rounded-full bg-secondary px-2.5 py-1 text-[10px] text-muted-foreground">
          {visits.length}
        </span>
      </div>
      <div className="space-y-2">
        {visits.map((visit) => (
          <button
            key={visit.id}
            type="button"
            onClick={() => onSelect(visit.id)}
            className={`group w-full rounded-[1.1rem] border p-3 text-left transition-all ${visit.id === activeId ? "border-mint/25 bg-mint-soft/70 shadow-[var(--shadow-card)]" : "border-white/70 bg-secondary/45 hover:bg-secondary/70"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{visit.case.subject.fullName}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {visit.case.client.displayName}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${stateTone[visit.status] ?? stateTone["ASSIGNED"]}`}
              >
                {humanize(visit.status)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <MapPin className="size-3 shrink-0 text-primary" />
              <span className="truncate">
                {visit.case.caseNumber} · {visit.address}
              </span>
              <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
