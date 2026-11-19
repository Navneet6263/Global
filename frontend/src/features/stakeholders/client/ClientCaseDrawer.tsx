import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, LifeBuoy, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Avatar, Button, Chip, ErrorText, Loading, Tabs } from "@/kit";
import { listClarifications } from "@/lib/api/clarifications";
import { getCase } from "@/lib/api/cases";
import { ClientEscalate } from "./ClientEscalate";
import { InterimReportButton } from "@/features/cases/InterimReportButton";
import { casePackageName } from "@/lib/backend-api/case-services";
import { ClientCaseDocuments } from "./ClientCaseDocuments";
import { ClientCaseTimeline } from "./ClientCaseTimeline";
import { ClientCaseOverview } from "./ClientCaseOverview";
import { ClientCaseChecks } from "./ClientCaseChecks";
import { ClientCaseProgress } from "./ClientCaseProgress";
import { caseDate, clientCaseActivity } from "./client-case-activity";
import { ClientClarificationCard } from "./ClientClarificationCard";
import { ClientReportReady } from "./ClientReportReady";
import { clientStatus, humanize, relativeTime, tatText } from "./client-portal-utils";

type CaseTab = "overview" | "checks" | "documents" | "requests" | "timeline";
const OPEN_DONE = ["RESOLVED", "CLOSED", "CANCELLED"];

const badge = (value?: number) =>
  value === undefined ? undefined : (
    <span className="rounded-full bg-subtle px-1.5 font-mono text-[11px] leading-[18px] text-dim">
      {value}
    </span>
  );

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-2.5">
      <dt className="text-[10.5px] font-semibold tracking-wider text-dim uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

export function ClientCaseDrawer({
  caseId,
  initialTab = "overview",
  canRespond,
  onClose,
}: {
  caseId: string;
  initialTab?: CaseTab;
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
  const [tab, setTab] = useState<CaseTab>(initialTab);
  const item = detail.data;
  const events = useMemo(() => (item ? clientCaseActivity(item) : []), [item]);
  const questions = clarifications.data?.items ?? [];
  const openRequests = clarifications.isSuccess
    ? questions.filter((question) => !OPEN_DONE.includes(question.status)).length
    : undefined;
  const shown = item ? clientStatus(item) : null;
  const copyNumber = () => {
    if (!item) return;
    void navigator.clipboard
      ?.writeText(item.caseNumber)
      .then(() => toast.success("Case number copied"))
      .catch(() => toast.error("Could not copy"));
  };
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
        className="flex h-[88%] max-h-[920px] w-[calc(100%-2rem)] max-w-[1180px] flex-col gap-0 overflow-hidden rounded-2xl border border-line bg-page p-0 text-ink shadow-2xl"
      >
        <header className="shrink-0 border-b border-line bg-surface">
          <div className="flex items-center gap-3.5 px-5 pt-5 pb-4 pr-12 sm:px-6">
            <Avatar name={item?.subject.fullName ?? "?"} className="size-12 rounded-xl text-base" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-wider text-brand uppercase">
                Verification workspace
              </p>
              <DialogTitle className="truncate text-[22px] font-bold tracking-tight">
                {item?.subject.fullName ?? (detail.isError ? "Case unavailable" : "Loading case")}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
                  {item ? (
                    <>
                      <button
                        type="button"
                        onClick={copyNumber}
                        title="Copy case number"
                        className="inline-flex items-center gap-1 rounded border border-line bg-subtle/60 px-1.5 py-0.5 font-mono text-[11px] text-ink hover:border-brand/40"
                      >
                        {item.caseNumber}
                        <Copy className="size-3 text-dim" aria-hidden />
                      </button>
                      <span>{item.client.displayName}</span>
                    </>
                  ) : (
                    <span>Your case details, documents and activity</span>
                  )}
                </div>
              </DialogDescription>
            </div>
            {shown ? (
              <Chip tone={shown.kind} dot className="hidden px-3 py-1 text-[13px] sm:inline-flex">
                {shown.label}
              </Chip>
            ) : null}
          </div>
          {item ? (
            <dl className="grid grid-cols-2 divide-line border-t border-line sm:grid-cols-3 sm:divide-x lg:grid-cols-6">
              <Fact label="Turnaround">{tatText(item.tatWorkingDays)}</Fact>
              <Fact label="Package">{casePackageName(item) || "Not available"}</Fact>
              <Fact label="Priority">{humanize(item.priority)}</Fact>
              <Fact label="Created">{caseDate(item.createdAt)}</Fact>
              <Fact label="Last updated">{relativeTime(item.updatedAt)}</Fact>
              <Fact label="Branch">{item.branch?.name ?? "Not assigned"}</Fact>
            </dl>
          ) : null}
        </header>
        {detail.isPending ? <Loading>Loading case detail…</Loading> : null}
        {detail.isError ? (
          <div className="m-6 rounded-lg bg-bad-soft p-4" role="alert">
            <p className="text-sm text-ink">{detail.error.message}</p>
            <Button
              className="mt-3"
              loading={detail.isFetching}
              onClick={() => void detail.refetch()}
            >
              Retry case
            </Button>
          </div>
        ) : null}
        {item && shown && !detail.isError ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_250px]">
              <main className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
                <ClientCaseProgress item={item} label={shown.label} detail={shown.detail} />
                {item.report ? (
                  <ClientReportReady report={item.report} caseNumber={item.caseNumber} />
                ) : null}
                <Tabs<CaseTab>
                  label="Case sections"
                  value={tab}
                  onChange={setTab}
                  tabs={[
                    ["overview", "Overview"],
                    ["checks", "Checks", badge(item.checks.length)],
                    ["documents", "Documents", badge(item.documents.length)],
                    ["requests", "Requests", badge(openRequests)],
                    ["timeline", "Timeline", badge(events.length)],
                  ]}
                />
                <div role="tabpanel" aria-label={tab} className="flex flex-col gap-3">
                  {tab === "overview" ? (
                    <ClientCaseOverview
                      item={item}
                      events={events}
                      requestCount={openRequests}
                      onSelect={(value) => setTab(value as CaseTab)}
                    />
                  ) : null}
                  {tab === "checks" ? <ClientCaseChecks checks={item.checks} /> : null}
                  {tab === "documents" ? (
                    <ClientCaseDocuments
                      requirements={
                        (
                          item as {
                            documentRequirements?: Array<{ type: string; checks: string[] }>;
                          }
                        ).documentRequirements
                      }
                      caseId={caseId}
                      caseStatus={item.status}
                      items={item.documents}
                    />
                  ) : null}
                  {tab === "timeline" ? <ClientCaseTimeline events={events} /> : null}
                  {tab === "requests" ? (
                    <>
                      {clarifications.isPending ? <Loading>Loading requests…</Loading> : null}
                      {clarifications.isError ? (
                        <ErrorText
                          onRetry={() => void clarifications.refetch()}
                          retrying={clarifications.isFetching}
                        >
                          {clarifications.error.message}
                        </ErrorText>
                      ) : null}
                      {questions.map((question) => (
                        <ClientClarificationCard
                          key={question.id}
                          caseId={caseId}
                          item={question}
                          canRespond={canRespond}
                        />
                      ))}
                      {clarifications.isSuccess && !questions.length ? (
                        <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
                          <MessageSquare className="mx-auto mb-3 size-6 text-brand" aria-hidden />
                          <p className="text-sm font-semibold text-ink">
                            No clarification is pending
                          </p>
                          <p className="mt-1 text-xs text-dim">
                            Questions from the verification team will appear here.
                          </p>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </main>
              <aside
                className="flex flex-col gap-3 border-t border-line bg-surface p-5 lg:border-t-0 lg:border-l"
                aria-label="Case summary"
              >
                <h3 className="text-[11px] font-semibold tracking-wider text-dim uppercase">
                  At a glance
                </h3>
                <Button
                  size="sm"
                  className="w-full"
                  loading={detail.isFetching || clarifications.isFetching}
                  onClick={() => {
                    void detail.refetch();
                    void clarifications.refetch();
                  }}
                >
                  <RefreshCw aria-hidden />
                  Refresh case
                </Button>
                <p className="text-xs text-dim">
                  Updated {relativeTime(item.updatedAt)} · {caseDate(item.updatedAt)}
                </p>
                <div className="rounded-xl bg-brand-soft p-3.5">
                  <LifeBuoy className="mb-2 size-5 text-brand" aria-hidden />
                  <p className="text-sm font-semibold text-ink">Need an update?</p>
                  <p className="mt-0.5 mb-2 text-xs leading-5 text-ink/75">
                    Contact support with this case number.
                  </p>
                  <Link
                    to="/client-portal/support"
                    onClick={onClose}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Open support →
                  </Link>
                </div>
                <p className="text-xs leading-5 text-dim">
                  {item.report
                    ? "The final report is ready: download it above or from the Reports section."
                    : "The final report appears here and in the Reports section once it is released."}
                </p>
              </aside>
            </div>
          </div>
        ) : null}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3">
          <span className="hidden text-xs text-dim sm:inline">
            Private · Visible only within your authorised workspace
          </span>
          <span className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {item && !detail.isError ? <InterimReportButton item={item} /> : null}
            {item && !detail.isError ? <ClientEscalate item={item} /> : null}
            <Button size="sm" onClick={onClose}>
              Close case detail
            </Button>
          </span>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
