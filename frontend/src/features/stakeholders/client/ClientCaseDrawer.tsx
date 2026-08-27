import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, ShieldCheck, X } from "lucide-react";

import { listClarifications } from "@/lib/api/clarifications";
import { getCase } from "@/lib/api/cases";
import { downloadReport, listReports } from "@/lib/api/reports";
import { ClientCaseDocuments } from "./ClientCaseDocuments";
import { ClientCaseTimeline } from "./ClientCaseTimeline";
import { ClientClarificationCard } from "./ClientClarificationCard";
import {
  caseStatusLabel,
  formatDate,
  humanize,
  relativeTime,
  slaText,
  statusTone,
} from "./client-portal-utils";

export function ClientCaseDrawer({
  caseId,
  canRespond,
  onClose,
}: {
  caseId: string;
  canRespond: boolean;
  onClose: () => void;
}) {
  const detail = useQuery({ queryKey: ["cases", caseId], queryFn: () => getCase(caseId) });
  const reports = useQuery({ queryKey: ["reports", caseId], queryFn: () => listReports(caseId) });
  const clarifications = useQuery({
    queryKey: ["clarifications", caseId],
    queryFn: () => listClarifications(caseId),
  });
  const item = detail.data;
  const completedChecks = item?.checks.filter((check) => check.status === "COMPLETED").length ?? 0;
  const progress = item?.checks.length
    ? Math.round((completedChecks / item.checks.length) * 100)
    : 0;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Case detail"
    >
      <button
        type="button"
        aria-label="Close case detail"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              Case detail
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {item?.subject.fullName ?? "Loading case"}
            </h2>
            <p className="text-xs text-slate-500">{item?.caseNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {detail.isError || reports.isError || clarifications.isError ? (
          <p className="m-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {detail.error?.message ?? reports.error?.message ?? clarifications.error?.message}
          </p>
        ) : null}
        <div className="space-y-5 p-5">
          {item ? (
            <section className="rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Overall progress
                  </p>
                  <p className="mt-1 text-sm font-semibold">{caseStatusLabel(item.status)}</p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-orange-300">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-orange-400"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-semibold">{progress}%</span>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                {completedChecks} of {item.checks.length} verification checks completed
              </p>
            </section>
          ) : null}
          <section className="grid gap-3 sm:grid-cols-3">
            <Fact label="SLA" value={item ? slaText(item.dueAt, item.status) : "Loading"} />
            <Fact label="Priority" value={humanize(item?.priority ?? "—")} />
            <Fact label="Last update" value={item ? relativeTime(item.updatedAt) : "Loading"} />
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading title="Verification checks" detail={`${item?.checks.length ?? 0} checks`} />
            <div className="divide-y divide-slate-100">
              {item?.checks.map((check) => (
                <div key={check.publicId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold">{humanize(check.type)}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {check.result ? humanize(check.result) : "Result pending"}
                    </p>
                  </div>
                  <Status value={check.status} />
                </div>
              ))}
            </div>
          </section>
          {item ? <ClientCaseTimeline items={item.statusHistory} /> : null}
          {item ? <ClientCaseDocuments caseId={caseId} items={item.documents} /> : null}
          <section className="rounded-2xl border border-slate-200">
            <Heading title="Published reports" detail="Versioned and authenticity protected" />
            <div className="space-y-2 p-4">
              {reports.data?.items.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => void downloadReport(report.id, item?.caseNumber ?? "Report")}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                >
                  <div>
                    <p className="text-xs font-semibold">Report version {report.currentVersion}</p>
                    <p className="text-[10px] text-slate-500">
                      {report.publishedAt
                        ? `Published ${formatDate(report.publishedAt)}`
                        : humanize(report.status)}
                    </p>
                  </div>
                  <Download className="h-4 w-4 text-slate-500" />
                </button>
              ))}
              {!reports.data?.items.length ? (
                <Empty text="No published report is available yet." />
              ) : null}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading title="Clarifications" detail="Questions and responses linked to this case" />
            <div className="space-y-3 p-4">
              {clarifications.data?.items.map((clarification) => (
                <ClientClarificationCard
                  key={clarification.id}
                  caseId={caseId}
                  item={clarification}
                  canRespond={canRespond}
                />
              ))}
              {!clarifications.data?.items.length ? (
                <Empty text="No clarification is pending." />
              ) : null}
            </div>
          </section>
          <a
            href={`/cases/${caseId}`}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Open complete Case 360 <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </aside>
    </div>
  );
}

function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <header className="border-b border-slate-200 px-4 py-3">
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="text-[10px] text-slate-500">{detail}</p>
    </header>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[9px] font-bold ring-1 ring-inset ${statusTone(value)}`}
    >
      {["OPEN", "RESPONDED", "RESOLVED"].includes(value) ? humanize(value) : caseStatusLabel(value)}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-slate-500">{text}</p>;
}
