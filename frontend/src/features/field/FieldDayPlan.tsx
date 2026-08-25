import type { ApiFieldVisit } from "./types";

const stateTone: Record<string, string> = {
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-violet-100 text-violet-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  EXCEPTION_REVIEW: "bg-amber-100 text-amber-700",
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Route queue</h2>
        <span className="text-[10px] text-slate-400">{visits.length} visits</span>
      </div>
      <div className="space-y-2">
        {visits.map((visit) => (
          <button
            key={visit.id}
            type="button"
            onClick={() => onSelect(visit.id)}
            className={`w-full rounded-xl border p-3 text-left transition-colors ${visit.id === activeId ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{visit.case.subject.fullName}</p>
                <p className="truncate text-[10px] text-slate-500">
                  {visit.case.client.displayName}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${stateTone[visit.status] ?? stateTone["ASSIGNED"]}`}
              >
                {visit.status.replaceAll("_", " ").toLowerCase()}
              </span>
            </div>
            <p className="mt-1.5 truncate text-[10px] text-slate-500">
              {visit.case.caseNumber} · {visit.address}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
