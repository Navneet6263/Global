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

  return (
    <section
      id="actions"
      className="scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_16px_44px_-34px_rgba(15,23,42,0.45)]"
    >
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950">Action centre</h2>
            {open.length ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">
                {open.length} waiting
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Re-upload requests, missing information and SLA risks in one queue.
          </p>
        </div>
        <p className="text-[10px] text-slate-400">
          Updated {data ? relativeTime(data.generatedAt) : "now"}
        </p>
      </header>

      {!open.length && !overdue.length && !underReview.length ? (
        <div className="flex flex-col items-center px-5 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-semibold">Your team is all caught up</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
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
                  className="group flex w-full items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/45 p-3.5 text-left transition hover:border-amber-200 hover:bg-amber-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700 shadow-sm">
                    <MessageSquareText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-xs font-semibold text-slate-900">
                        {item.subject}
                      </span>
                      <span
                        className={`rounded-full bg-white px-2 py-0.5 text-[9px] font-bold ${isDocumentRequest(item.subject, item.latestMessage?.body) ? "text-red-700" : "text-amber-700"}`}
                      >
                        {isDocumentRequest(item.subject, item.latestMessage?.body)
                          ? "Document re-upload"
                          : "Response required"}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-slate-600">
                      {item.latestMessage?.body ??
                        "Sapling Global needs additional information before verification can continue."}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700">
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
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-amber-700" />
                </button>
              ))}
              {!open.length ? <CompactEmpty text="No response is pending from your team." /> : null}
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
                    className="flex w-full items-center gap-3 rounded-2xl bg-red-50/65 p-3 text-left transition hover:bg-red-50"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-red-600">
                      <Clock3 className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold">
                        {item.subject.fullName}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-red-700">
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
                <p className="mt-2 rounded-2xl bg-blue-50 px-3.5 py-3 text-[11px] leading-5 text-blue-800">
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
      <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="text-[10px] font-semibold text-slate-400">{count}</span>
    </div>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-slate-50 px-3 py-5 text-center text-[11px] text-slate-500">
      {text}
    </p>
  );
}

function isDocumentRequest(subject: string, message?: string) {
  return /document|upload|aadhaar|aadhar|pan card|passport|certificate|blur|cropped|expired/i.test(
    `${subject} ${message ?? ""}`,
  );
}
