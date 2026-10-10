import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  FileSearch,
  Files,
  ListChecks,
  Mail,
  MessageSquareText,
  Truck,
} from "lucide-react";
import { useState } from "react";

import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getVerifierTaskContext, type VerificationTask } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import { Avatar, Pill } from "@/components/workspace/kit";
import type { Tone } from "@/components/workspace/tones";
import { formatDate, humanize } from "../utils";

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
  { id: "clarifications", label: "Clarifications", icon: MessageSquareText },
  { id: "activity", label: "Activity", icon: Activity },
] as const;

export function VerifierTaskDesk({
  task,
  onUpdated,
}: {
  task: VerificationTask;
  onUpdated: () => Promise<void>;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("verification");
  const context = useQuery({
    queryKey: ["tasks", task.id, "context"],
    queryFn: () => getVerifierTaskContext(task.id),
    staleTime: 20_000,
  });
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
      {tab === "verification" ? (
        <VerifierTaskWorkspace
          key={`${task.id}-${task.version}`}
          task={task}
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
        <SourceEmailPanel checkId={task.check.publicId} readOnly={task.status === "COMPLETED"} />
      )}
      {tab === "methods" && (
        <VerificationMethodsPanel
          checkId={task.check.publicId}
          caseId={task.check.case.publicId}
          readOnly={task.status === "COMPLETED"}
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
