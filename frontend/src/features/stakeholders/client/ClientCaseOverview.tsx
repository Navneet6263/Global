import { ArrowRight, FileText, MessageSquare, CheckCheck, Clock3, CircleDot } from "lucide-react";
import type { CaseDetail } from "@/lib/api/cases";
import { Button } from "@/components/ui/button";
import { caseJourney, clientNextStep, caseDate, type CaseActivity } from "./client-case-activity";

export function ClientCaseOverview({
  item,
  events,
  requestCount,
  onSelect,
}: {
  item: CaseDetail;
  events: CaseActivity[];
  requestCount?: number;
  onSelect: (tab: string) => void;
}) {
  const next = clientNextStep(item.status);
  const recorded = new Set(
    item.statusHistory.flatMap((event) => [event.fromStatus, event.toStatus]),
  );
  const completed = item.checks.filter((check) => check.status === "COMPLETED").length;
  const rejected = item.documents.filter((document) => document.status === "REJECTED").length;
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/70 to-white p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-blue-600">
            <CircleDot className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
              What happens next
            </p>
            <h3 className="mt-1 text-base font-bold text-slate-900">{next.title}</h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-600">{next.text}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-2 rounded-lg border-blue-200 bg-white text-blue-700 shadow-none"
              onClick={() => onSelect(next.target)}
            >
              {next.action}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </section>
      <section
        className="rounded-xl border border-slate-200 bg-white p-4"
        aria-label="Recorded case journey"
      >
        <h3 className="text-sm font-bold">Case journey</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Highlighted stage is current. Recorded stages are not a guarantee that every check passed.
        </p>
        <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {caseJourney.map((stage, index) => {
            const active = stage.statuses.includes(item.status);
            const seen = stage.statuses.some((status) => recorded.has(status));
            return (
              <li
                key={stage.label}
                aria-current={active ? "step" : undefined}
                className={`rounded-lg border p-2.5 ${active ? "border-blue-300 bg-blue-50" : "border-slate-100 bg-slate-50/60"}`}
              >
                <span
                  className={`mb-2 grid size-5 place-items-center rounded-full text-[10px] font-bold ${active ? "bg-blue-600 text-white" : "bg-white text-slate-500"}`}
                >
                  {index + 1}
                </span>
                <strong className="block text-[11px] leading-4 text-slate-800">
                  {stage.label}
                </strong>
                <span
                  className={`mt-1 block text-[10px] ${active ? "font-semibold text-blue-700" : "text-slate-500"}`}
                >
                  {active ? "Current stage" : seen ? "Recorded" : "Not recorded"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: "Checks",
            value: `${completed}/${item.checks.length}`,
            detail: "Completed checks",
            icon: CheckCheck,
            tab: "checks",
            colour: "bg-blue-50 text-blue-600",
          },
          {
            label: "Documents",
            value: String(item.documents.length),
            detail: rejected ? `${rejected} need replacement` : "Document records",
            icon: FileText,
            tab: "documents",
            colour: "bg-violet-50 text-violet-600",
          },
          {
            label: "Open requests",
            value: requestCount === undefined ? "—" : String(requestCount),
            detail:
              requestCount === undefined ? "Loading or unavailable" : "Questions from the team",
            icon: MessageSquare,
            tab: "requests",
            colour: "bg-amber-50 text-amber-600",
          },
        ].map(({ label, value, detail, icon: Icon, tab, colour }) => (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(tab)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300 hover:bg-blue-50/20"
          >
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${colour}`}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-slate-600">{label}</span>
              <strong className="mt-1 block text-xl font-bold text-slate-900">{value}</strong>
              <span className="mt-1 block text-[10px] text-slate-500">{detail}</span>
            </span>
            <ArrowRight className="size-3.5 text-slate-400" />
          </button>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold">Latest updates</h3>
          <button
            type="button"
            onClick={() => onSelect("timeline")}
            className="text-xs font-semibold text-blue-600"
          >
            View all activity →
          </button>
        </header>
        <div className="divide-y divide-slate-100">
          {events.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-start gap-3 px-4 py-3">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-blue-500" />
              <div>
                <p className="text-xs font-semibold">{event.title}</p>
                <time dateTime={event.at} className="mt-1 block text-[11px] text-slate-500">
                  {caseDate(event.at)}
                </time>
              </div>
            </div>
          ))}
          {!events.length && (
            <p className="p-4 text-xs text-slate-500">No dated updates available yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
