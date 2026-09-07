import { useQuery } from "@tanstack/react-query";
import { Activity, FileSearch, Files, ListChecks, MessageSquareText } from "lucide-react";
import { useState } from "react";

import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getVerifierTaskContext, type VerificationTask } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import {
  ActivityView,
  CaseContextView,
  ClarificationsView,
  DocumentsView,
} from "./VerifierContextViews";
import { VerifierTaskWorkspace } from "./VerifierTaskWorkspace";

const tabs = [
  { id: "verification", label: "Verification", icon: ListChecks },
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
        className="flex gap-1 overflow-x-auto rounded-[1.3rem] border border-white/80 bg-card/85 p-1.5 shadow-[var(--shadow-card)]"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[10.5px] font-medium transition",
              tab === item.id
                ? "bg-mint-deep text-white shadow-[var(--shadow-card)]"
                : "text-muted-foreground hover:bg-mint-soft hover:text-foreground",
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
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
      {tab !== "verification" && context.isLoading ? (
        <WorkspaceLoading label="Loading protected case context" />
      ) : null}
      {tab !== "verification" && context.isError ? (
        <WorkspaceError message={context.error.message} onRetry={() => void context.refetch()} />
      ) : null}
      {context.data ? (
        <section
          className={cn(
            "rounded-[1.65rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] sm:p-6",
            tab === "verification" && "hidden",
          )}
        >
          {tab === "context" ? <CaseContextView context={context.data} /> : null}
          {tab === "documents" ? <DocumentsView context={context.data} /> : null}
          {tab === "clarifications" ? <ClarificationsView context={context.data} /> : null}
          {tab === "activity" ? <ActivityView context={context.data} /> : null}
        </section>
      ) : null}
    </div>
  );
}
