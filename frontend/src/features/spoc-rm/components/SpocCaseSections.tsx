import type { ReactNode } from "react";
import { AlertTriangle, CircleCheck, Clock3, User } from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { cn } from "@/lib/utils";
import type { SpocCaseDetail } from "../contracts/spoc";
import { HOLDER_LABEL, statusTone } from "../config/spoc-meta";
import { date, dateTime, label, money } from "../utils/spoc-format";

function Block({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-[13.5px] font-semibold text-slate-900">{title}</h3>
        {count !== undefined ? (
          <span className="num rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-600">
            {count}
          </span>
        ) : null}
      </header>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function Line({
  title,
  detail,
  status,
}: {
  title: ReactNode;
  detail?: ReactNode;
  status?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900">{title}</p>
        {detail ? <p className="mt-0.5 text-[12px] text-slate-500">{detail}</p> : null}
      </div>
      {status ? <StatusBadge label={label(status)} tone={statusTone(status)} /> : null}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="px-4 py-6 text-center text-[12.5px] text-slate-500">{text}</p>
);

export function SpocCaseSummary({ item }: { item: SpocCaseDetail }) {
  const facts: Array<[string, ReactNode]> = [
    [
      "With",
      `${HOLDER_LABEL[item.holderRole]}${item.currentOwner ? ` · ${item.currentOwner}` : ""}`,
    ],
    ["Client", `${item.client.displayName} (${label(item.client.status)})`],
    ["Client reference", item.externalRef ?? "—"],
    [
      "Branch",
      item.branch ? [item.branch.name, item.branch.city].filter(Boolean).join(", ") : "Unbranched",
    ],
    ["Ops owner", item.opsOwner ?? "Unassigned"],
    ["QA reviewer", item.qaReviewer ?? "—"],
    ["Priority / risk", `${label(item.priority)} / ${label(item.riskLevel)}`],
    ["SLA due", date(item.dueAt)],
    ["Created", dateTime(item.createdAt)],
    ["Completed", date(item.completedAt)],
  ];
  return (
    <section
      aria-label="Case facts"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-[13.5px] font-semibold text-slate-900">Case facts</h3>
      </header>
      <dl className="grid gap-px bg-slate-100 sm:grid-cols-2">
        {facts.map(([term, value]) => (
          <div key={term} className="flex items-start justify-between gap-3 bg-white px-4 py-2.5">
            <dt className="text-[12.5px] text-slate-500">{term}</dt>
            <dd className="text-right text-[13px] font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const RESULT_TONE: Record<string, string> = {
  CLEAR: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DISCREPANCY: "bg-red-50 text-red-700 ring-red-200",
  UNABLE_TO_VERIFY: "bg-amber-50 text-amber-800 ring-amber-200",
};

export function SpocCaseChecks({ item }: { item: SpocCaseDetail }) {
  if (!item.checks.length)
    return (
      <Block title="Checks" count={0}>
        <Empty text="No checks on this case yet." />
      </Block>
    );
  return (
    <ul aria-label="Checks" className="grid gap-3">
      {item.checks.map((check) => {
        const overdue =
          check.dueAt && !check.completedAt && new Date(check.dueAt).getTime() < Date.now();
        return (
          <li
            key={check.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="flex flex-wrap items-center gap-2 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-slate-900">
                  {label(check.type)}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-[12px]",
                    overdue ? "font-medium text-red-600" : "text-slate-500",
                  )}
                >
                  {check.completedAt ? (
                    <>
                      <CircleCheck className="size-3.5" aria-hidden /> Completed{" "}
                      {date(check.completedAt)}
                    </>
                  ) : (
                    <>
                      <Clock3 className="size-3.5" aria-hidden /> Due {date(check.dueAt)}
                    </>
                  )}
                </span>
              </span>
              {check.result ? (
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11.5px] font-semibold ring-1",
                    RESULT_TONE[check.result] ?? "bg-slate-50 text-slate-600 ring-slate-200",
                  )}
                >
                  {label(check.result)}
                </span>
              ) : null}
              <StatusBadge label={label(check.status)} tone={statusTone(check.status)} />
            </header>
            {check.sourceSummary ? (
              <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[12.5px] leading-relaxed text-slate-700">
                {check.sourceSummary}
              </p>
            ) : null}
            {check.tasks.length || check.findings.length ? (
              <div className="grid gap-1.5 border-t border-slate-100 px-4 py-2.5">
                {check.tasks.map((task) => (
                  <p key={task.id} className="flex items-center gap-1.5 text-[12px] text-slate-600">
                    <User className="size-3.5 text-slate-400" aria-hidden />
                    {task.assignee ?? "Unassigned"} · {label(task.status)} · due {date(task.dueAt)}
                    {task.blockerReason ? (
                      <span className="font-medium text-amber-700">
                        · blocked: {task.blockerReason}
                      </span>
                    ) : null}
                  </p>
                ))}
                {check.findings.map((finding) => (
                  <p
                    key={finding.id}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-red-700"
                  >
                    <AlertTriangle className="size-3.5" aria-hidden />
                    {label(finding.severity)} · {label(finding.kind)}: {finding.title}
                  </p>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function SpocCaseFieldAndDocuments({ item }: { item: SpocCaseDetail }) {
  return (
    <div className="grid gap-4">
      <Block title="Documents" count={item.documents.length}>
        {item.documents.length ? (
          item.documents.map((document) => (
            <Line
              key={document.id}
              title={label(document.type)}
              detail={`Version ${document.currentVersion} · updated ${dateTime(document.updatedAt)}`}
              status={document.status}
            />
          ))
        ) : (
          <Empty text="No documents requested." />
        )}
      </Block>
      <Block title="Field visits" count={item.fieldVisits.length}>
        {item.fieldVisits.length ? (
          item.fieldVisits.map((visit) => (
            <Line
              key={visit.id}
              title={visit.address}
              detail={`${visit.assignee ?? "Unassigned"} · ${
                visit.checkedInAt
                  ? `checked in ${dateTime(visit.checkedInAt)}, ${Math.round(visit.distanceMeters ?? 0)} m (limit ${visit.geofenceMeters} m)`
                  : "not checked in"
              } · ${visit.evidenceCount} evidence file(s)`}
              status={visit.status}
            />
          ))
        ) : (
          <Empty text="No field visit on this case." />
        )}
      </Block>
    </div>
  );
}

export function SpocCaseReviews({ item }: { item: SpocCaseDetail }) {
  return (
    <div className="grid gap-4">
      <Block title="QA decisions" count={item.qaReviews.length}>
        {item.qaReviews.length ? (
          item.qaReviews.map((review) => (
            <Line
              key={review.id}
              title={`${review.reviewer} · ${dateTime(review.createdAt)}`}
              detail={review.notes ?? undefined}
              status={review.decision}
            />
          ))
        ) : (
          <Empty text="No QA decision yet." />
        )}
      </Block>
      <Block title="Clarifications" count={item.clarifications.length}>
        {item.clarifications.length ? (
          item.clarifications.map((row) => (
            <Line
              key={row.id}
              title={row.subject}
              detail={`Raised ${date(row.createdAt)} · due ${date(row.dueAt)}`}
              status={row.status}
            />
          ))
        ) : (
          <Empty text="No clarifications." />
        )}
      </Block>
      <Block title="Invoices" count={item.invoices.length}>
        {item.invoices.length ? (
          item.invoices.map((invoice) => (
            <Line
              key={`${invoice.id}-${invoice.lineTotal}`}
              title={invoice.invoiceNumber}
              detail={`${money(invoice.lineTotal)} · due ${date(invoice.dueAt)}`}
              status={invoice.status}
            />
          ))
        ) : (
          <Empty text="Not invoiced yet." />
        )}
      </Block>
    </div>
  );
}
