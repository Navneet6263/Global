import { useQuery } from "@tanstack/react-query";
import { Activity, FileSearch, Files, ListChecks, MessageSquareText } from "lucide-react";
import { useState } from "react";

import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getVerifierTaskContext, type VerificationTask } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import { ActivityView, CaseContextView, ClarificationsView } from "./VerifierContextViews";
import { VerifierDocumentsView } from "./VerifierDocumentsView";
import { VerifierTaskWorkspace } from "./VerifierTaskWorkspace";
import { VerificationMethodsPanel } from "./VerificationMethodsPanel";

const tabs = [
  { id: "verification", label: "Verification", icon: ListChecks },
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
  return (
    <div className="min-w-0 space-y-3">
      <nav
        aria-label="Selected task workspace"
        className="grid grid-cols-2 gap-1.5 rounded-[1.3rem] border border-white/80 bg-card/85 p-2 shadow-[var(--shadow-card)] sm:grid-cols-3"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-[11px] font-medium leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint",
              tab === item.id
                ? "bg-mint-deep text-white shadow-[var(--shadow-card)]"
                : "text-muted-foreground hover:bg-mint-soft hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 whitespace-normal">{item.label}</span>
          </button>
        ))}
      </nav>
      {tab === "verification" ? (
        <VerifierTaskWorkspace
          key={`${task.id}-${task.version}`}
          task={task}
          onUpdated={onUpdated}
        />
      ) : null}
      {tab === "methods" && (
        <VerificationMethodsPanel
          checkId={task.check.publicId}
          caseId={task.check.case.publicId}
          readOnly={task.status === "COMPLETED"}
        />
      )}
      {tab !== "verification" && tab !== "methods" && context.isLoading ? (
        <WorkspaceLoading label="Loading protected case context" />
      ) : null}
      {tab !== "verification" && context.isError ? (
        <WorkspaceError message={context.error.message} onRetry={() => void context.refetch()} />
      ) : null}
      {context.data && tab !== "methods" ? (
        <section
          className={cn(
            "rounded-[1.65rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] sm:p-6",
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
