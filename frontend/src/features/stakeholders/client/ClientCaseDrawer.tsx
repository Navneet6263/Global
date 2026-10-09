import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCheck,
  FileText,
  Clock3,
  MessageSquare,
  ShieldCheck,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { listClarifications } from "@/lib/api/clarifications";
import { getCase } from "@/lib/api/cases";
import { ClientEscalate } from "./ClientEscalate";
import { InterimReportButton } from "@/features/cases/InterimReportButton";
import { casePackageName } from "@/lib/backend-api/case-services";
import { ClientCaseDocuments } from "./ClientCaseDocuments";
import { ClientCaseTimeline } from "./ClientCaseTimeline";
import { ClientCaseOverview } from "./ClientCaseOverview";
import { ClientCaseChecks } from "./ClientCaseChecks";
import { caseDate, clientCaseActivity } from "./client-case-activity";
import { ClientClarificationCard } from "./ClientClarificationCard";
import { caseStatusLabel, humanize, relativeTime, statusTone } from "./client-portal-utils";

export function ClientCaseDrawer({
  caseId,
  canRespond,
  onClose,
}: {
  caseId: string;
  canRespond: boolean;
  onClose: () => void;
}) {
  const opener = useRef(
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement),
  );
  const detail = useQuery({ queryKey: ["cases", caseId], queryFn: () => getCase(caseId) });
  const clarifications = useQuery({
    queryKey: ["clarifications", caseId],
    queryFn: () => listClarifications(caseId),
  });
  const [tab, setTab] = useState("overview");
  const item = detail.data;
  const events = useMemo(() => (item ? clientCaseActivity(item) : []), [item]);
  const completed = item?.checks.filter((check) => check.status === "COMPLETED").length ?? 0;
  const progress = item?.checks.length ? Math.round((completed / item.checks.length) * 100) : 0;
  const questions = clarifications.data?.items ?? [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-label="Case detail"
        aria-labelledby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus();
        }}
        className="client-case-workspace flex h-[85%] max-h-[900px] w-[calc(100%-2rem)] max-w-[1160px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4 pr-12 sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-600">
              Verification workspace
            </p>
            <DialogTitle className="truncate text-xl font-bold">
              {item?.subject.fullName ?? (detail.isError ? "Case unavailable" : "Loading case")}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-slate-500">
              {item
                ? `${item.caseNumber} · ${item.client.displayName}`
                : "Your case details, documents and activity"}
            </DialogDescription>
          </div>
          {item && (
            <span
              className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:block ${statusTone(item.status)}`}
            >
              {caseStatusLabel(item.status)}
            </span>
          )}
        </header>
        {detail.isPending && (
          <div className="space-y-4 p-6" aria-label="Loading case detail">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-60 rounded-xl" />
          </div>
        )}
        {detail.isError && (
          <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
            <p className="text-sm">{detail.error.message}</p>
            <Button
              variant="outline"
              className="mt-3"
              loading={detail.isFetching}
              onClick={() => void detail.refetch()}
            >
              Retry case
            </Button>
          </div>
        )}
        {item && !detail.isError && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_260px]">
              <main className="min-w-0 p-4 sm:p-6">
                <section
                  className="mb-5 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4"
                  aria-label="Case progress"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {caseStatusLabel(item.status)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {completed} of {item.checks.length} checks completed
                      </p>
                    </div>
                    <div className="text-right">
                      <strong className="text-2xl font-bold text-blue-600">{progress}%</strong>
                      <span className="block text-[10px] text-slate-500">Checks complete</span>
                    </div>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Checks completed"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100"
                  >
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </section>
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:grid-cols-5">
                    {[
                      { value: "overview", label: "Overview", icon: LayoutDashboard },
                      {
                        value: "checks",
                        label: `Checks (${item.checks.length})`,
                        icon: CheckCheck,
                      },
                      {
                        value: "documents",
                        label: `Documents (${item.documents.length})`,
                        icon: FileText,
                      },
                      { value: "requests", label: "Requests", icon: MessageSquare },
                      { value: "timeline", label: "Timeline", icon: Clock3 },
                    ].map(({ value, label, icon: Icon }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="gap-1.5 rounded-lg py-2.5 text-xs font-semibold data-[state=active]:text-blue-700"
                      >
                        <Icon className="size-3.5" />
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value="overview">
                    <ClientCaseOverview
                      item={item}
                      events={events}
                      requestCount={
                        clarifications.isSuccess
                          ? questions.filter(
                              (question) =>
                                !["RESOLVED", "CLOSED", "CANCELLED"].includes(question.status),
                            ).length
                          : undefined
                      }
                      onSelect={setTab}
                    />
                  </TabsContent>
                  <TabsContent value="checks">
                    <ClientCaseChecks checks={item.checks} />
                  </TabsContent>
                  <TabsContent value="documents">
                    <ClientCaseDocuments
                      caseId={caseId}
                      caseStatus={item.status}
                      items={item.documents}
                    />
                  </TabsContent>
                  <TabsContent value="timeline">
                    <ClientCaseTimeline events={events} />
                  </TabsContent>
                  <TabsContent value="requests" className="space-y-3">
                    {clarifications.isPending && (
                      <p role="status" className="p-4 text-sm text-slate-500">
                        Loading requests…
                      </p>
                    )}
                    {clarifications.isError && (
                      <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm">
                        {clarifications.error.message}
                        <Button
                          variant="outline"
                          className="mt-2"
                          onClick={() => void clarifications.refetch()}
                        >
                          Retry requests
                        </Button>
                      </div>
                    )}
                    {questions.map((question) => (
                      <ClientClarificationCard
                        key={question.id}
                        caseId={caseId}
                        item={question}
                        canRespond={canRespond}
                      />
                    ))}
                    {clarifications.isSuccess && !questions.length && (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                        <MessageSquare className="mx-auto mb-3 size-6 text-blue-400" />
                        <p className="text-sm font-semibold">No clarification is pending</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Questions from the verification team will appear here.
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </main>
              <aside
                className="space-y-5 border-t border-slate-200 bg-slate-50/70 p-5 lg:border-l lg:border-t-0"
                aria-label="Case summary"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  At a glance
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 rounded-lg bg-white"
                  loading={detail.isFetching || clarifications.isFetching}
                  onClick={() => {
                    void detail.refetch();
                    void clarifications.refetch();
                  }}
                >
                  <RefreshCw className="size-3.5" />
                  Refresh case
                </Button>
                <dl className="space-y-4">
                  {[
                    ["Expected by", caseDate(item.dueAt)],
                    ["Created", caseDate(item.createdAt)],
                    ["Priority", humanize(item.priority)],
                    [
                      "Last updated",
                      `${relativeTime(item.updatedAt)} · ${caseDate(item.updatedAt)}`,
                    ],
                    ["Package", casePackageName(item) || "Not available"],
                    ["Branch", item.branch?.name ?? "Not assigned"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] text-slate-500">{label}</dt>
                      <dd className="mt-1 break-words text-xs font-semibold leading-5">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-xl border border-blue-100 bg-white p-3">
                  <p className="text-xs font-bold">Need an update?</p>
                  <p className="mb-3 mt-1 text-xs leading-5 text-slate-500">
                    Contact support with this case number.
                  </p>
                  <Link
                    to="/client-portal/support"
                    onClick={onClose}
                    className="text-xs font-semibold text-blue-700"
                  >
                    Open support →
                  </Link>
                </div>
                <p className="text-[11px] leading-5 text-slate-500">
                  Final report downloads are available in the Reports section after authorised
                  release.
                </p>
              </aside>
            </div>
          </div>
        )}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <span className="hidden text-[11px] text-slate-500 sm:inline">
            Private · Visible only within your authorised workspace
          </span>
          <span className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {item && !detail.isError ? <InterimReportButton item={item} /> : null}
            {item && !detail.isError ? <ClientEscalate item={item} /> : null}
            <Button variant="outline" size="sm" className="rounded-lg" onClick={onClose}>
              Close case detail
            </Button>
          </span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
