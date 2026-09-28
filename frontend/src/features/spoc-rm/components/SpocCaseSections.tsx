import type { ReactNode } from "react";
import { StatusBadge } from "@/components/feedback/status-badge";
import type { SpocCaseDetail } from "../contracts/spoc";
import { HOLDER_LABEL, statusTone } from "../config/spoc-meta";
import { date, dateTime, label, money } from "../utils/spoc-format";

function Block({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80">
      <header className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {count !== undefined ? (
          <span className="num text-[10px] text-muted-foreground">{count}</span>
        ) : null}
      </header>
      <div className="divide-y divide-border/60">{children}</div>
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
    <div className="flex items-start justify-between gap-3 px-4 py-2.5 text-xs">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        {detail ? <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p> : null}
      </div>
      {status ? <StatusBadge label={label(status)} tone={statusTone(status)} /> : null}
    </div>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="px-4 py-4 text-center text-[11px] text-muted-foreground">{text}</p>
);

export function SpocCaseSummary({ item }: { item: SpocCaseDetail }) {
  const facts: Array<[string, ReactNode]> = [
    [
      "With",
      `${HOLDER_LABEL[item.holderRole]}${item.currentOwner ? ` · ${item.currentOwner}` : ""}`,
    ],
    ["Client", `${item.client.displayName} (${label(item.client.status)})`],
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
    <dl className="grid gap-2 sm:grid-cols-3">
      {facts.map(([term, value]) => (
        <div key={term} className="rounded-xl border border-border bg-card/70 px-3 py-2">
          <dt className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
            {term}
          </dt>
          <dd className="mt-0.5 text-xs font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SpocCaseChecks({ item }: { item: SpocCaseDetail }) {
  return (
    <Block title="Checks, tasks and findings" count={item.checks.length}>
      {item.checks.length ? (
        item.checks.map((check) => (
          <div key={check.id} className="px-4 py-3">
            <Line
              title={label(check.type)}
              detail={`${check.result ? label(check.result) : "Result pending"} · due ${date(check.dueAt)}${check.sourceSummary ? ` · ${check.sourceSummary}` : ""}`}
              status={check.status}
            />
            {check.tasks.map((task) => (
              <p key={task.id} className="px-4 text-[10px] text-muted-foreground">
                Task {label(task.status)} · {task.assignee ?? "Unassigned"} · due {date(task.dueAt)}
                {task.blockerReason ? ` · blocked: ${task.blockerReason}` : ""}
              </p>
            ))}
            {check.findings.map((finding) => (
              <p key={finding.id} className="px-4 text-[10px] text-critical-foreground">
                {label(finding.severity)} finding · {label(finding.kind)}: {finding.title}
              </p>
            ))}
          </div>
        ))
      ) : (
        <Empty text="No checks on this case yet." />
      )}
    </Block>
  );
}

export function SpocCaseFieldAndDocuments({ item }: { item: SpocCaseDetail }) {
  return (
    <div className="space-y-3">
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
      <Block title="Documents (status only)" count={item.documents.length}>
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
    </div>
  );
}

export function SpocCaseReviews({ item }: { item: SpocCaseDetail }) {
  return (
    <div className="space-y-3">
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
      <Block title="Reports" count={item.reports.length}>
        {item.reports.length ? (
          item.reports.map((report) => (
            <Line
              key={report.id}
              title={`Version ${report.currentVersion}`}
              detail={
                report.publishedAt
                  ? `Published ${date(report.publishedAt)}`
                  : `Created ${date(report.createdAt)}`
              }
              status={report.status}
            />
          ))
        ) : (
          <Empty text="No report generated yet." />
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
