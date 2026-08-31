import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileWarning,
  MessageSquareText,
} from "lucide-react";

import type { ExceptionsDashboard } from "@/lib/api/dashboards";
import { formatDate, relativeTime } from "./client-portal-utils";

export function ClientActionCenter({
  data,
  onOpen,
}: {
  data: ExceptionsDashboard | undefined;
  onOpen: (caseId: string) => void;
}) {
  const open = data?.clarifications.filter((item) => item.status === "OPEN") ?? [];
  const underReview = data?.clarifications.filter((item) => item.status === "RESPONDED") ?? [];
  const overdue = data?.overdue ?? [];
  const actionCount = data?.summary.clientActions ?? 0;
  const rejectedDocumentCount = Math.max(0, actionCount - open.length);

  return (
    <section id="actions" className="surface scroll-mt-28 overflow-hidden rounded-[1.75rem]">
      <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Action centre</h2>
            {actionCount ? (
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[9px] font-semibold text-warning-foreground ring-1 ring-warning/20">
                {actionCount} waiting
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Re-upload requests, missing information and SLA risks in one queue.
          </p>
        </div>
        <p className="num text-[10px] text-muted-foreground">
          Updated {data ? relativeTime(data.generatedAt) : "now"}
        </p>
      </header>

      {!actionCount && !overdue.length && !underReview.length ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-success-soft text-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">Your team is all caught up</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            New document or information requests will appear here with a clear reason and due time.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 p-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div>
            <SectionLabel icon={FileWarning} label="Needs your response" count={open.length} />
            <div className="mt-2 space-y-2">
              {open.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpen(item.case.publicId)}
                  className="group flex w-full items-start gap-3 rounded-2xl border border-warning/20 bg-warning-soft/55 p-3.5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-px hover:border-warning/35"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-warning-foreground shadow-[var(--shadow-card)]">
                    <MessageSquareText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {item.subject}
                      </span>
                      <span
                        className={`rounded-full bg-card px-2 py-0.5 text-[9px] font-semibold ${isDocumentRequest(item.subject, item.latestMessage?.body) ? "text-critical-foreground" : "text-warning-foreground"}`}
                      >
                        {isDocumentRequest(item.subject, item.latestMessage?.body)
                          ? "Document re-upload"
                          : "Response required"}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                      {item.latestMessage?.body ??
                        "Sapling Global needs additional information before verification can continue."}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {item.case.subject.fullName}
                      </span>
                      <span>{item.case.caseNumber}</span>
                      <span>
                        {item.dueAt
                          ? `Due ${formatDate(item.dueAt)}`
                          : relativeTime(item.createdAt)}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-warning-foreground" />
                </button>
              ))}
              {!open.length ? <CompactEmpty text="No response is pending from your team." /> : null}
              {rejectedDocumentCount ? (
                <div className="rounded-2xl border border-critical/15 bg-critical-soft/55 p-3.5 text-[11px] leading-5 text-critical-foreground">
                  <p className="font-semibold">
                    {rejectedDocumentCount} rejected document{" "}
                    {rejectedDocumentCount === 1 ? "version needs" : "versions need"} replacement
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Open the affected verification below and use its Documents section to upload a
                    corrected version.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <SectionLabel icon={AlertCircle} label="SLA attention" count={overdue.length} />
              <div className="mt-2 space-y-2">
                {overdue.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpen(item.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-critical/15 bg-critical-soft/65 p-3 text-left transition hover:border-critical/30"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-card text-critical">
                      <Clock3 className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold">
                        {item.subject.fullName}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-critical-foreground">
                        {item.caseNumber} · overdue since {formatDate(item.dueAt)}
                      </span>
                    </span>
                  </button>
                ))}
                {!overdue.length ? <CompactEmpty text="No case is overdue." /> : null}
              </div>
            </div>
            {underReview.length ? (
              <div>
                <SectionLabel
                  icon={CheckCircle2}
                  label="Response under review"
                  count={underReview.length}
                />
                <p className="mt-2 rounded-2xl border border-info/15 bg-info-soft px-3.5 py-3 text-[11px] leading-5 text-info-foreground">
                  Your team has replied on {underReview.length}{" "}
                  {underReview.length === 1 ? "case" : "cases"}. Sapling Global is reviewing the
                  information.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function SectionLabel({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof FileWarning;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="num text-[10px] font-semibold text-muted-foreground">{count}</span>
    </div>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border-strong bg-muted/25 px-3 py-5 text-center text-[11px] text-muted-foreground">
      {text}
    </p>
  );
}

function isDocumentRequest(subject: string, message?: string) {
  return /document|upload|aadhaar|aadhar|pan card|passport|certificate|blur|cropped|expired/i.test(
    `${subject} ${message ?? ""}`,
  );
}
