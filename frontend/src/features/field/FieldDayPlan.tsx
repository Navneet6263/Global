import type { ApiFieldVisit } from "./types";

const stateTone: Record<string, string> = {
  ASSIGNED: "bg-secondary text-muted-foreground",
  IN_PROGRESS: "bg-info/12 text-info",
  COMPLETED: "bg-accent text-accent-foreground",
  EXCEPTION_REVIEW: "bg-warning/25 text-warning-foreground",
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
    <section className="surface rounded-3xl p-4">
      <h2 className="mb-3 text-sm font-semibold">Assigned visits</h2>
      <div className="space-y-2">
        {visits.map((visit) => (
          <button
            key={visit.id}
            type="button"
            onClick={() => onSelect(visit.id)}
            className={`w-full rounded-2xl p-3 text-left transition-colors ${visit.id === activeId ? "bg-secondary" : "bg-secondary/60"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{visit.case.subject.fullName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {visit.case.client.displayName}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${stateTone[visit.status] ?? stateTone["ASSIGNED"]}`}
              >
                {visit.status.replaceAll("_", " ").toLowerCase()}
              </span>
            </div>
            <p className="num mt-1.5 truncate text-[11px] text-muted-foreground">
              {visit.case.caseNumber} · {visit.address}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
