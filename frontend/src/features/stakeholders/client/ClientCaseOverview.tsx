import { ArrowRight, CheckCheck, CircleDot, Clock3, FileText, MessageSquare } from "lucide-react";
import type { CaseDetail } from "@/lib/api/cases";
import { Button, Card, CardHeader, SOFT, type Tone } from "@/kit";
import { cn } from "@/lib/utils";
import { clientNextStep, caseDate, type CaseActivity } from "./client-case-activity";

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
  const next = clientNextStep(item.status, item.clientProgress?.stage);
  const completed = item.checks.filter((check) => check.status === "COMPLETED").length;
  const rejected = item.documents.filter((document) => document.status === "REJECTED").length;
  const quick: Array<{
    label: string;
    value: string;
    detail: string;
    icon: typeof CheckCheck;
    tab: string;
    tone: Tone;
  }> = [
    {
      label: "Checks",
      value: `${completed}/${item.checks.length}`,
      detail: "Completed checks",
      icon: CheckCheck,
      tab: "checks",
      tone: "brand",
    },
    {
      label: "Documents",
      value: String(item.documents.length),
      detail: rejected ? `${rejected} need replacement` : "Document records",
      icon: FileText,
      tab: "documents",
      tone: "note",
    },
    {
      label: "Open requests",
      value: requestCount === undefined ? "—" : String(requestCount),
      detail: requestCount === undefined ? "Loading or unavailable" : "Questions from the team",
      icon: MessageSquare,
      tab: "requests",
      tone: "warn",
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-start gap-3 rounded-xl border border-brand/15 bg-brand-soft p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface text-brand">
          <CircleDot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-brand uppercase">
            What happens next
          </p>
          <h3 className="mt-0.5 text-base font-bold text-ink">{next.title}</h3>
          <p className="mt-1 text-sm leading-5 text-ink/80">{next.text}</p>
          <Button size="sm" className="mt-3" onClick={() => onSelect(next.target)}>
            {next.action}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {quick.map(({ label, value, detail, icon: Icon, tab, tone }) => (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(tab)}
            className="flex items-center gap-3 rounded-lg border border-line bg-surface shadow-soft p-3 text-left transition hover:border-brand/40"
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", SOFT[tone])}>
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wider text-dim uppercase">
                {label}
              </span>
              <strong className="block font-mono text-xl font-semibold text-ink">{value}</strong>
              <span className="block text-xs text-dim">{detail}</span>
            </span>
            <ArrowRight className="size-4 text-dim" aria-hidden />
          </button>
        ))}
      </div>
      <Card>
        <CardHeader
          title="Latest updates"
          aside={
            <button
              type="button"
              onClick={() => onSelect("timeline")}
              className="text-xs font-semibold text-brand hover:underline"
            >
              View all activity →
            </button>
          }
        />
        <div className="divide-y divide-line">
          {events.slice(0, 3).map((event) => (
            <div key={event.id} className="flex items-start gap-3 px-4 py-3">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-ink">{event.title}</p>
                <time dateTime={event.at} className="block text-xs text-dim">
                  {caseDate(event.at)}
                </time>
              </div>
            </div>
          ))}
          {!events.length ? (
            <p className="p-4 text-sm text-dim">No dated updates available yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
