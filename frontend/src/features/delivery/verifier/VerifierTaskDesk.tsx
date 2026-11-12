import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  FileSearch,
  Files,
  ListChecks,
  Mail,
  MessageSquareText,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getVerifierTaskContext, type VerificationTask } from "@/lib/api/tasks";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { useVerifierDepartment } from "@/lib/auth/verifier-department";
import { cn } from "@/lib/utils";
import { Avatar, Pill } from "@/components/workspace/kit";
import type { Tone } from "@/components/workspace/tones";
import { formatDate, humanize } from "../utils";
import { PeerTaskBanner } from "./PeerTaskBanner";

const STATUS_TONE: Record<string, Tone> = {
  COMPLETED: "good",
  BLOCKED: "bad",
  IN_PROGRESS: "info",
};
import { ActivityView, CaseContextView, ClarificationsView } from "./VerifierContextViews";
import { VerifierDocumentsView } from "./VerifierDocumentsView";
import { VerifierTaskWorkspace } from "./VerifierTaskWorkspace";
import { VerificationMethodsPanel } from "./VerificationMethodsPanel";
import { SourceEmailPanel } from "./SourceEmailPanel";
import { CheckVendorPanel } from "@/features/vendor-checks/CheckVendorPanel";
import { internalVendorApi } from "@/lib/backend-api/vendor-checks";

const tabs = [
  { id: "verification", label: "Verification", icon: ListChecks },
  { id: "email", label: "Source email", icon: Mail },
  { id: "vendor", label: "Vendor", icon: Truck },
  { id: "methods", label: "Sources & methods", icon: FileSearch },
  { id: "context", label: "Case context", icon: FileSearch },
  { id: "documents", label: "Documents", icon: Files },
  { id: "clarifications", label: "Insufficiency", icon: MessageSquareText },
  { id: "activity", label: "Activity", icon: Activity },
] as const;

export function VerifierTaskDesk({
  task,
  departmentId,
  onUpdated,
}: {
  task: VerificationTask;
  departmentId?: string;
  onUpdated: () => Promise<void>;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("verification");
  const queryClient = useQueryClient();
  const me = cachedIdentity()?.userId;
  const { isLead, supervisor } = useVerifierDepartment();
  const isPeerReadOnly = Boolean(task.assignee && me && task.assignee.id !== me);
  const canManagePeerTask = isLead || supervisor;
  const context = useQuery({
    queryKey: ["tasks", task.id, "context", departmentId ?? "all"],
    queryFn: () => getVerifierTaskContext(task.id, departmentId),
    staleTime: 20_000,
  });
  const reentryStamp =
    context.data?.check.case.clarifications.find(
      (item) =>
        item.level === "L2" &&
        item.isForCurrentCheck !== false &&
        item.status === "RESOLVED" &&
        Boolean(item.reentryCompletedAt),
    )?.reentryCompletedAt ?? null;
  useEffect(() => {
    if (!reentryStamp) return;
    void queryClient.invalidateQueries({
      queryKey: ["checks", task.check.publicId, "verified-details"],
    });
  }, [queryClient, reentryStamp, task.check.publicId]);
  // Vendor: only when the check is with a vendor, or the viewer may send it (TL / RM).
  const vendor = useQuery({
    queryKey: ["vendor-checks", "check", task.check.publicId],
    queryFn: () => internalVendorApi.forCheck(task.check.publicId),
    staleTime: 30_000,
  });
  const showVendor = Boolean(vendor.data?.canManage || vendor.data?.attempts?.length);
  // Each team sees its own process: Digital works online (no source email), Vendor
  // works through the vendor job (no source email or manual methods).
  const team = task.check.department?.teamType;
  const visibleTabs = tabs.filter((item) => {
    if (item.id === "vendor") return team === "VENDOR" || showVendor;
    if (item.id === "email") return team !== "DIGITAL" && team !== "VENDOR";
    if (item.id === "methods") return team !== "VENDOR";
    return true;
  });
  return (
    <div className="min-w-0 space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-4">
          <Avatar name={task.check.case.subject.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-slate-900">
              {task.check.case.subject.fullName}
            </h2>
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-slate-500">
              <span className="rounded-md bg-blue-50 px-1.5 font-mono text-[11.5px] font-semibold text-blue-700">
                {task.check.case.caseNumber}
              </span>
              <span>{task.check.case.client.displayName}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="info">{humanize(task.check.type)}</Pill>
            <Pill tone={STATUS_TONE[task.status] ?? "warn"}>{humanize(task.status)}</Pill>
            {task.assignee?.name ? (
              <Pill tone={isPeerReadOnly ? "neutral" : "info"}>
                Claimed by {task.assignee.name}
              </Pill>
            ) : null}
            {task.check.status === "TL_REVIEW" ? (
              <Pill tone="violet">With Team Leader for review</Pill>
            ) : null}
            {task.dueAt && task.status !== "COMPLETED" ? (
              <Pill tone={new Date(task.dueAt).getTime() < Date.now() ? "bad" : "neutral"}>
                Due {formatDate(task.dueAt)}
              </Pill>
            ) : null}
          </div>
        </header>
        <nav
          aria-label="Selected task workspace"
          className="flex flex-wrap gap-1 border-t border-slate-100 bg-slate-50/60 px-3 py-2"
        >
          {visibleTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                  active
                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:bg-white hover:text-slate-900",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      {isPeerReadOnly ? (
        <PeerTaskBanner task={task} me={me} canManage={canManagePeerTask} onUpdated={onUpdated} />
      ) : null}
      {context.data?.check.case.status === "CLARIFICATION_PENDING" ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-950"
        >
          <span>
            <strong>On hold for an insufficiency.</strong>{" "}
            {context.data.check.case.clarifications.some(
              (item) => item.level === "L2" && item.status === "DATA_ENTRY_PENDING",
            )
              ? "Operations forwarded the corrected document to Data Entry for detail re-entry."
              : context.data.check.case.clarifications.some(
                    (item) => item.level === "L2" && item.status === "CANDIDATE_SUBMITTED",
                  )
                ? "The candidate submitted a corrected document. Waiting for Operations review and Data Entry handoff."
                : context.data.check.case.clarifications.some((item) => item.status === "RESPONDED")
                  ? "The candidate has replied. Review the reply and resolve it to continue; until then your work cannot be saved."
                  : "Waiting for the candidate's corrected document and explanation."}
          </span>
          {tab !== "clarifications" ? (
            <button
              type="button"
              onClick={() => setTab("clarifications")}
              className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-600"
            >
              Open Insufficiency
            </button>
          ) : null}
        </div>
      ) : null}
      {context.data?.check.case.status !== "CLARIFICATION_PENDING" &&
      task.status !== "COMPLETED" &&
      context.data?.check.case.clarifications.some(
        (item) =>
          item.level === "L2" &&
          item.isForCurrentCheck !== false &&
          item.status === "RESOLVED" &&
          Boolean(item.reentryCompletedAt),
      ) ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-950"
        >
          <span>
            <strong>All details re-entered by Data Entry.</strong> Review the updated candidate
            details and promoted document version, then complete your independent final
            verification.
          </span>
          {tab !== "clarifications" ? (
            <button
              type="button"
              onClick={() => setTab("clarifications")}
              className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700"
            >
              View re-entry summary
            </button>
          ) : null}
        </div>
      ) : null}
      {tab === "verification" ? (
        <VerifierTaskWorkspace
          key={`${task.id}-${task.version}-${isPeerReadOnly ? "ro" : "rw"}`}
          task={task}
          readOnly={isPeerReadOnly}
          onUpdated={onUpdated}
          onOpenTab={(id) => setTab(id as (typeof tabs)[number]["id"])}
          quickTabs={visibleTabs
            .filter((item) => ["documents", "email", "vendor", "methods"].includes(item.id))
            .map((item) => ({ id: item.id, label: item.label }))}
          vendorApproved={Boolean(
            vendor.data?.attempts?.some((attempt) => attempt.status === "APPROVED"),
          )}
        />
      ) : null}
      {tab === "vendor" && <CheckVendorPanel checkId={task.check.publicId} />}
      {tab === "email" && (
        <SourceEmailPanel
          checkId={task.check.publicId}
          readOnly={task.status === "COMPLETED" || isPeerReadOnly}
        />
      )}
      {tab === "methods" && (
        <VerificationMethodsPanel
          checkId={task.check.publicId}
          caseId={task.check.case.publicId}
          readOnly={task.status === "COMPLETED" || isPeerReadOnly}
        />
      )}
      {!["verification", "methods", "verified", "email", "vendor", "proof"].includes(tab) &&
      context.isLoading ? (
        <WorkspaceLoading label="Loading protected case context" />
      ) : null}
      {!["verification", "methods", "verified", "email", "vendor", "proof"].includes(tab) &&
      context.isError ? (
        <WorkspaceError message={context.error.message} onRetry={() => void context.refetch()} />
      ) : null}
      {context.data && !["methods", "verified", "email", "vendor", "proof"].includes(tab) ? (
        <section
          className={cn(
            "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6",
            tab === "verification" && "hidden",
          )}
        >
          {tab === "context" ? <CaseContextView context={context.data} /> : null}
          {tab === "documents" ? (
            <VerifierDocumentsView key={task.id} context={context.data} />
          ) : null}
          {tab === "clarifications" ? <ClarificationsView context={context.data} /> : null}
          {tab === "activity" ? <ActivityView context={context.data} /> : null}
        </section>
      ) : null}
    </div>
  );
}
