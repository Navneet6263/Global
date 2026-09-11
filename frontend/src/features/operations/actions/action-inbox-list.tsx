import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCheck, Clock3 } from "lucide-react";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { actionMeta, type ActionKind, type ActionInboxData } from "./action-inbox-model";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";

export function ActionInboxList({
  data,
  action,
  onPage,
  onStart,
  canStart,
}: {
  data: ActionInboxData;
  action: ActionKind;
  onPage: (page: number) => void;
  onStart: (id: string) => void;
  canStart: boolean;
}) {
  const meta = actionMeta[action];
  if (!data.items.length)
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <CheckCheck aria-hidden />
        </span>
        <p className="font-semibold">No matching work in this queue</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Try another category or clear the search. New pending work appears automatically.
        </p>
      </div>
    );
  return (
    <>
      <ul className="divide-y divide-border/60" aria-label={`${meta.label} cases`}>
        {data.items.map((row) => {
          const overdue = row.dueAt && new Date(row.dueAt).getTime() < Date.now();
          const buttonClass =
            "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
          return (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-secondary/20 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{row.candidateName}</p>
                  {overdue ? (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                      Overdue
                    </span>
                  ) : null}
                </div>
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  title={`${row.caseNumber} · ${row.clientName}`}
                >
                  {row.caseNumber} · {row.clientName}
                </p>
              </div>
              <div className="col-span-2 row-start-2 space-y-1.5 text-[11px] md:col-span-1 md:col-start-2 md:row-start-1">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 font-medium ${meta.colour}`}>
                    {row.quantity} {meta.unit} pending
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-1">
                    {humanize(row.status)}
                  </span>
                </div>
                {action === "field_assignment" ? (
                  <p className="font-medium text-amber-800">
                    {row.checksComplete
                      ? "Verifier work complete · physical visit still required"
                      : "Physical visit can run alongside verifier checks"}
                  </p>
                ) : null}
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Clock3 className="size-3 shrink-0" aria-hidden />
                  <time dateTime={row.activityAt}>Activity {formatDateTime(row.activityAt)}</time>
                </p>
              </div>
              {action === "start" && canStart ? (
                <button type="button" className={buttonClass} onClick={() => onStart(row.id)}>
                  {meta.button}
                  <ArrowUpRight className="size-4" aria-hidden />
                </button>
              ) : (
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: row.id }}
                  search={{ tab: meta.tab, inbox: action }}
                  className={buttonClass}
                  aria-label={
                    action === "field_assignment" && row.status === "QA_REVIEW"
                      ? "Return for field work"
                      : action === "start"
                        ? "View readiness"
                        : meta.button
                  }
                  title={action === "start" ? "View readiness" : meta.button}
                >
                  Open
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <PaginationBar
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        onPageChange={onPage}
        label="cases"
      />
    </>
  );
}
