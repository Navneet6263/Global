import { useQuery } from "@tanstack/react-query";
import { Download, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
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
      className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-[3px]"
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
      <aside className="relative h-full w-full max-w-[46rem] overflow-y-auto rounded-l-[2rem] border-l border-white/80 bg-background/95 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-background/90 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Case detail
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              {item?.subject.fullName ?? (detail.isError ? "Case unavailable" : "Loading case")}
            </h2>
            <p className="num text-xs text-muted-foreground">{item?.caseNumber}</p>
          </div>
          <button
            type="button"
            aria-label="Close case detail"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {detail.isError || reports.isError || clarifications.isError ? (
          <p className="m-5 rounded-xl border border-critical/20 bg-critical-soft p-3 text-sm text-critical-foreground">
            {detail.error?.message ?? reports.error?.message ?? clarifications.error?.message}
          </p>
        ) : null}
        <div className={detail.isError ? "hidden" : "space-y-5 p-5"}>
          {detail.isPending ? <DrawerSkeleton /> : null}
          {item ? (
            <section
              className="relative overflow-hidden rounded-[1.5rem] p-5 text-white shadow-[var(--shadow-raise)]"
              style={{
                background:
                  "linear-gradient(145deg, oklch(0.43 0.07 168), oklch(0.29 0.045 172) 72%)",
              }}
            >
              <span
                aria-hidden
                className="absolute -right-8 -top-10 size-32 rounded-full bg-white/10"
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    Overall progress
                  </p>
                  <p className="mt-1 text-sm font-semibold">{caseStatusLabel(item.status)}</p>
                </div>
                <span className="relative grid size-9 place-items-center rounded-full bg-white/10 text-amber-200">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="num text-xs font-semibold">{progress}%</span>
              </div>
              <p className="mt-2 text-[10px] text-white/60">
                {completedChecks} of {item.checks.length} verification checks completed
              </p>
            </section>
          ) : null}
          <section className="grid gap-3 sm:grid-cols-3">
            <Fact label="SLA" value={item ? slaText(item.dueAt, item.status) : "Loading"} />
            <Fact label="Priority" value={humanize(item?.priority ?? "—")} />
            <Fact label="Last update" value={item ? relativeTime(item.updatedAt) : "Loading"} />
          </section>
          <section className="surface overflow-hidden rounded-2xl">
            <Heading title="Verification checks" detail={`${item?.checks.length ?? 0} checks`} />
            <div className="divide-y divide-border/70">
              {item?.checks.map((check) => (
                <div key={check.publicId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{humanize(check.type)}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {check.result ? humanize(check.result) : "Result pending"}
                    </p>
                  </div>
                  <Status value={check.status} />
                </div>
              ))}
            </div>
          </section>
          {item ? <ClientCaseTimeline items={item.statusHistory} /> : null}
          {item ? (
            <ClientCaseDocuments caseId={caseId} caseStatus={item.status} items={item.documents} />
          ) : null}
          <section className="surface overflow-hidden rounded-2xl">
            <Heading title="Published reports" detail="Versioned and authenticity protected" />
            <div className="space-y-2 p-4">
              {reports.data?.items.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() =>
                    void downloadReport(report.id, item?.caseNumber ?? "Report").catch(
                      (error: unknown) =>
                        toast.error("Report could not be downloaded", {
                          description: error instanceof Error ? error.message : undefined,
                        }),
                    )
                  }
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left shadow-[var(--shadow-card)] transition hover:border-mint/25 hover:bg-mint-soft/35"
                >
                  <div>
                    <p className="text-xs font-semibold">Report version {report.currentVersion}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {report.publishedAt
                        ? `Published ${formatDate(report.publishedAt)}`
                        : humanize(report.status)}
                    </p>
                  </div>
                  <Download className="size-4 text-mint-deep" />
                </button>
              ))}
              {!reports.data?.items.length ? (
                <Empty text="No published report is available yet." />
              ) : null}
            </div>
          </section>
          <section className="surface overflow-hidden rounded-2xl">
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
        </div>
      </aside>
    </div>
  );
}

function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <header className="border-b border-border px-4 py-3">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      <p className="text-[10px] text-muted-foreground">{detail}</p>
    </header>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-card/75 p-3 shadow-[var(--shadow-card)]">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-foreground">{value}</p>
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
function DrawerSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading case detail">
      <Skeleton className="h-36 rounded-[1.5rem]" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
      <Skeleton className="h-44 rounded-2xl" />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{text}</p>;
}
