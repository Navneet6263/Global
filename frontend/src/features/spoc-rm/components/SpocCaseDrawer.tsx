import { useState } from "react";
import { CalendarClock, ListChecks, UserRound } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ReportPreviewButton } from "@/features/workflow-ui/ReportPreview";
import { CaseReportView } from "@/features/workflow-ui/ReportView";
import { cn } from "@/lib/utils";
import { HOLDER_LABEL, statusTone } from "../config/spoc-meta";
import { useSpocCase } from "../hooks/use-spoc";
import { date, label } from "../utils/spoc-format";
import { SpocCaseReport } from "./SpocCaseReport";
import {
  SpocCaseChecks,
  SpocCaseFieldAndDocuments,
  SpocCaseReviews,
  SpocCaseSummary,
} from "./SpocCaseSections";
import { SpocCaseTimeline } from "./SpocCaseTimeline";

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "report", label: "Full report" },
  { value: "checks", label: "Checks" },
  { value: "documents", label: "Documents & field" },
  { value: "reviews", label: "Reviews & billing" },
  { value: "timeline", label: "Timeline" },
] as const;
type Tab = (typeof tabs)[number]["value"];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/**
 * One case for the RM: header and key facts, the final report (download / regenerate),
 * the full on-screen report with proof photos, checks, documents, reviews and timeline.
 */
export function SpocCaseDrawer({
  caseId,
  onClose,
}: {
  caseId: string | undefined;
  onClose: () => void;
}) {
  const detail = useSpocCase(caseId);
  const [tab, setTab] = useState<Tab>("overview");
  const item = detail.data;
  const done = item?.checks.filter((check) => check.completedAt).length ?? 0;
  const total = item?.checks.length ?? 0;
  const overdue = item?.dueAt && !item.completedAt && new Date(item.dueAt).getTime() < Date.now();

  return (
    <Sheet open={Boolean(caseId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-5xl"
        aria-label="Case"
      >
        <SheetHeader className="space-y-0 border-b border-slate-200 px-5 pb-0 pt-5 text-left">
          <div className="flex flex-wrap items-start gap-3 pr-8">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-50 text-[14px] font-semibold text-blue-700">
              {item ? initials(item.candidateName) : "…"}
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-[18px]">
                {item?.candidateName ?? (detail.isError ? "Case unavailable" : "Loading case")}
                {item ? (
                  <StatusBadge label={label(item.status)} tone={statusTone(item.status)} />
                ) : null}
              </SheetTitle>
              <SheetDescription className="text-[12.5px]">
                {item
                  ? [item.caseNumber, item.client.displayName, item.externalRef]
                      .filter(Boolean)
                      .join(" · ")
                  : "Case details"}
              </SheetDescription>
            </div>
            {item ? (
              <ReportPreviewButton
                caseId={item.id}
                caseNumber={item.caseNumber}
                candidateName={item.candidateName}
                audiences={["client"]}
                label="Report preview"
              />
            ) : null}
          </div>
          {item ? (
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Fact icon={UserRound} label="With">
                {HOLDER_LABEL[item.holderRole]}
                {item.currentOwner ? ` · ${item.currentOwner}` : ""}
              </Fact>
              <Fact icon={CalendarClock} label="SLA due" alert={Boolean(overdue)}>
                {date(item.dueAt)}
                {overdue ? " · overdue" : ""}
              </Fact>
              <Fact icon={ListChecks} label="Checks">
                <span className="flex items-center gap-2">
                  {done}/{total}
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-emerald-500"
                      style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                    />
                  </span>
                </span>
              </Fact>
              <Fact label="Priority / risk">
                {label(item.priority)} / {label(item.riskLevel)}
              </Fact>
            </dl>
          ) : null}
          <nav aria-label="Case sections" className="mt-3 flex gap-1 overflow-x-auto">
            {tabs.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={tab === entry.value}
                onClick={() => setTab(entry.value)}
                className={cn(
                  "relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition",
                  tab === entry.value ? "text-slate-900" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {entry.label}
                {tab === entry.value ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600" />
                ) : null}
              </button>
            ))}
          </nav>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-5">
          {detail.isError ? (
            <ErrorState
              description={detail.error.message}
              onRetry={() => void detail.refetch()}
              retrying={detail.isFetching}
            />
          ) : !item ? (
            <ListSkeleton rows={6} />
          ) : (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
              {tab === "overview" ? (
                <>
                  <SpocCaseReport item={item} />
                  <SpocCaseSummary item={item} />
                </>
              ) : null}
              {tab === "report" ? <CaseReportView caseId={item.id} audience="client" /> : null}
              {tab === "checks" ? <SpocCaseChecks item={item} /> : null}
              {tab === "documents" ? <SpocCaseFieldAndDocuments item={item} /> : null}
              {tab === "reviews" ? <SpocCaseReviews item={item} /> : null}
              {tab === "timeline" ? <SpocCaseTimeline item={item} active /> : null}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Fact({
  icon: Icon,
  label: name,
  alert,
  children,
}: {
  icon?: typeof UserRound;
  label: string;
  alert?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {name}
      </dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-[13px] font-semibold",
          alert ? "text-red-600" : "text-slate-900",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
