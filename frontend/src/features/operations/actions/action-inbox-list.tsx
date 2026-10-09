import { Link } from "@tanstack/react-router";
import { CheckCheck, ChevronRight } from "lucide-react";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { actionMeta, type ActionKind, type ActionInboxData } from "./action-inbox-model";
import { humanize } from "@/features/cases/case-detail-formatting";
import { initials, istDateTime } from "../workspace/ops-queue-model";
import { dueLabel } from "@/features/workflow-ui/flow-model";

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
      <div className="attn-empty">
        <CheckCheck aria-hidden />
        <span>
          <strong className="text-slate-700">No matching work in this queue</strong> — try another
          category or clear the search. New work appears automatically.
        </span>
      </div>
    );
  return (
    <>
      <ul className="attn-rows" aria-label={`${meta.label} cases`}>
        {data.items.map((row) => {
          const due = dueLabel(row.dueAt);
          const overdue = due.tone === "bad";
          return (
            <li key={row.id} className={`attn-row ${overdue ? "is-overdue" : ""}`}>
              <span className="attn-avatar" aria-hidden>
                {initials(row.candidateName)}
              </span>
              <span className="attn-row-who">
                <strong>{row.candidateName}</strong>
                <small title={`${row.caseNumber} · ${row.clientName}`}>
                  {row.caseNumber} · {row.clientName}
                </small>
              </span>
              <span className="attn-row-mid">
                <span>
                  <i className={`attn-dot ${overdue ? "is-bad" : "is-info"}`} aria-hidden />
                  {row.quantity} {meta.unit} pending · {humanize(row.status)}
                </span>
                <small>
                  {action === "field_assignment"
                    ? row.checksComplete
                      ? "Verifier work complete · physical visit still required"
                      : "Physical visit can run alongside verifier checks"
                    : `Last activity ${istDateTime(row.activityAt)}`}
                </small>
              </span>
              <span className={`attn-row-due is-${due.tone}`}>{due.text}</span>
              {action === "start" && canStart ? (
                <button
                  type="button"
                  className="attn-go is-primary"
                  onClick={() => onStart(row.id)}
                >
                  {meta.button}
                  <ChevronRight aria-hidden />
                </button>
              ) : (
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: row.id }}
                  search={{ tab: meta.tab, inbox: action }}
                  className="attn-go"
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
                  <ChevronRight aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {data.total > data.pageSize ? (
        <div className="attn-foot">
          <PaginationBar
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={onPage}
            label="cases"
          />
        </div>
      ) : null}
    </>
  );
}
