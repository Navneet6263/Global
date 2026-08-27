import { MessagesSquare, FileText } from "lucide-react";
import type { VerificationCase } from "@/lib/contracts/case";
import { STAGE_META } from "@/lib/contracts/case";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime, formatRelativeToNow } from "@/lib/formatting";
import { TONE_DOT } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";

export function CaseClarificationsPanel({ item }: { item: VerificationCase }) {
  if (item.clarifications.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No open clarifications"
        description="Clarifications raised by verifiers, QA or the client appear here with their due time."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {item.clarifications.map((clarification) => (
        <li
          key={clarification.id}
          className="space-y-2 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusBadge
              label={`For ${clarification.audience}`}
              tone={clarification.audience === "client" ? "info" : "warning"}
            />
            <span className="text-[11px] text-muted-foreground">
              Due {formatDateTime(clarification.dueAt)}
            </span>
          </div>
          <p className="text-[13px] text-foreground">{clarification.question}</p>
          <p className="text-[11px] text-muted-foreground">
            Raised by {clarification.raisedBy} · {formatRelativeToNow(clarification.raisedAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function CaseTimelinePanel({ item }: { item: VerificationCase }) {
  return (
    <ol className="space-y-0">
      {item.timeline.map((event, index) => (
        <li key={event.id} className="flex gap-3">
          <span className="flex flex-col items-center">
            <span
              className={cn("mt-1.5 size-2 rounded-full", TONE_DOT[STAGE_META[event.stage].tone])}
              aria-hidden
            />
            {index < item.timeline.length - 1 ? (
              <span className="w-px flex-1 bg-border" aria-hidden />
            ) : null}
          </span>
          <span className="min-w-0 flex-1 pb-5">
            <span className="block text-[13px] font-medium text-foreground">{event.label}</span>
            <span className="block text-xs text-muted-foreground">{event.detail}</span>
            <span className="block text-[11px] text-muted-foreground/80">
              {formatDateTime(event.at)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function CaseAssignmentsPanel({ item }: { item: VerificationCase }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {item.assignments.map((entry) => (
        <li key={entry.id} className="px-4 py-3">
          <p className="text-[13px] font-medium text-foreground">
            {entry.owner} <span className="text-muted-foreground">· {entry.role}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">{entry.reason}</p>
          <p className="text-[11px] text-muted-foreground/80">From {formatDateTime(entry.from)}</p>
        </li>
      ))}
    </ul>
  );
}

export function CaseReportsPanel({ item }: { item: VerificationCase }) {
  if (item.reports.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No report published yet"
        description="A report becomes available once QA signs off every check in the bundle."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {item.reports.map((report) => (
        <li key={report.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">Report {report.version}</p>
            <p className="text-[11px] text-muted-foreground">
              Published {formatDateTime(report.publishedAt)} · {report.sizeKb} KB
            </p>
          </div>
          <StatusBadge
            label={report.outcome === "clear" ? "Clear" : "Minor discrepancy"}
            tone={report.outcome === "clear" ? "success" : "warning"}
          />
        </li>
      ))}
    </ul>
  );
}
