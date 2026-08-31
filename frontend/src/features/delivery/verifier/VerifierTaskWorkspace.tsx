import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Ban, CheckCircle2, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { updateTask, type FindingInput, type VerificationTask } from "@/lib/api/tasks";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { formatDate, humanize } from "../utils";
import { FindingEditor } from "./FindingEditor";
import { Status } from "./VerifierQueue";
import {
  loadVerifierDraft,
  removeVerifierDraft,
  saveVerifierDraft,
  type VerifierResult,
} from "./verifier-draft";
import {
  BlockerEditor,
  CompletedTask,
  PrimaryButton,
  SecondaryButton,
  WorkspaceInfo,
  WorkspaceNotice,
} from "./VerifierWorkspaceParts";

export function VerifierTaskWorkspace({
  task,
  onUpdated,
}: {
  task: VerificationTask;
  onUpdated: () => Promise<void>;
}) {
  const draftKey = `verifier-draft:${task.id}`;
  const deviceDataScope = cachedIdentity()?.deviceDataScope;
  const [result, setResult] = useState<VerifierResult>("CLEAR");
  const [sourceSummary, setSourceSummary] = useState("");
  const [findings, setFindings] = useState<FindingInput[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showBlock, setShowBlock] = useState(false);
  useEffect(() => {
    if (!deviceDataScope) {
      setDraftReady(true);
      return;
    }
    let active = true;
    void loadVerifierDraft(deviceDataScope, draftKey)
      .then((stored) => {
        if (!active || !stored) return;
        setResult(stored.result);
        setSourceSummary(stored.sourceSummary);
        setFindings(stored.findings);
      })
      .finally(() => {
        if (active) setDraftReady(true);
      });
    return () => {
      active = false;
    };
  }, [deviceDataScope, draftKey]);
  useEffect(() => {
    if (!deviceDataScope || !draftReady || task.status !== "IN_PROGRESS") return;
    const timer = window.setTimeout(() => {
      void saveVerifierDraft(deviceDataScope, {
        key: draftKey,
        result,
        sourceSummary,
        findings,
        savedAt: new Date().toISOString(),
      }).catch(() => toast.error("Secure working draft could not be saved"));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [deviceDataScope, draftKey, draftReady, findings, result, sourceSummary, task.status]);
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTask>[1]) => updateTask(task.id, input),
    onSuccess: async (_, input) => {
      if (input.status === "COMPLETED" && deviceDataScope) {
        void removeVerifierDraft(deviceDataScope, draftKey);
      }
      toast.success(
        input.status === "COMPLETED"
          ? "Check completed and sent forward"
          : input.status === "BLOCKED"
            ? "Blocker recorded"
            : "Verification started",
      );
      await onUpdated();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const findingsValid = findings.every(
    (item) =>
      item.title.trim().length >= 3 &&
      item.description.trim().length >= 3 &&
      (!item.source || item.source.trim().length >= 3),
  );
  const ready =
    sourceSummary.trim().length >= 3 &&
    findingsValid &&
    (result !== "DISCREPANCY" || findings.length > 0);
  const complete = () =>
    mutation.mutate({
      status: "COMPLETED",
      version: task.version,
      result,
      sourceSummary: sourceSummary.trim(),
      findings: findings.map((item) => {
        const source = item.source?.trim();
        return {
          ...item,
          title: item.title.trim(),
          description: item.description.trim(),
          ...(source ? { source } : {}),
        };
      }),
    });
  return (
    <section className="relative overflow-hidden rounded-[1.65rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm sm:p-6">
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-mint via-primary/55 to-warning" />
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Status status={task.status} />
            <span className="text-[9.5px] text-muted-foreground">Version {task.version}</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-foreground">
            {humanize(task.check.type)} verification
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {task.check.case.subject.fullName} · {task.check.case.client.displayName}
          </p>
        </div>
      </header>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <WorkspaceInfo label="Case" value={task.check.case.caseNumber} />
        <WorkspaceInfo label="Priority" value={humanize(task.check.case.priority)} />
        <WorkspaceInfo label="Due" value={task.dueAt ? formatDate(task.dueAt) : "Not set"} />
      </div>
      {task.instructions ? (
        <WorkspaceNotice title="Assignment instructions" detail={task.instructions} />
      ) : null}
      {["OPEN", "UNASSIGNED"].includes(task.status) ? (
        <div className="mt-5 rounded-[1.35rem] border border-white/80 bg-mint-soft/40 p-4 shadow-[var(--shadow-card)]">
          <p className="text-[12px] font-medium text-foreground">
            Ready to begin this source check?
          </p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            Starting records ownership and opens a user-scoped working draft on this device.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({ status: "IN_PROGRESS", version: task.version, findings: [] })
              }
            >
              <Play className="h-4 w-4" /> Start verification
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowBlock(true)}>
              <Ban className="h-4 w-4" /> Record blocker
            </SecondaryButton>
          </div>
        </div>
      ) : null}
      {task.status === "IN_PROGRESS" ? (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) complete();
          }}
        >
          <section className="rounded-[1.35rem] border border-white/80 bg-background/60 p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold">Verification outcome</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Choose the defensible result supported by your source record.
                </p>
              </div>
              <span className="rounded-full bg-mint-soft px-2.5 py-1 text-[9px] font-medium text-mint-deep">
                Required
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"] as VerifierResult[]).map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setResult(value)}
                  aria-pressed={result === value}
                  className={`rounded-[1rem] border px-3 py-3 text-[11px] font-medium transition ${result === value ? "border-mint-deep bg-mint-deep text-white shadow-[var(--shadow-card)]" : "border-border bg-white/70 text-muted-foreground hover:border-mint/30 hover:bg-mint-soft/50"}`}
                >
                  {humanize(value)}
                </button>
              ))}
            </div>
          </section>
          <label className="block rounded-[1.35rem] border border-white/80 bg-background/60 p-4 text-[11px] font-semibold shadow-[var(--shadow-card)]">
            Source summary
            <textarea
              value={sourceSummary}
              onChange={(event) => setSourceSummary(event.target.value)}
              rows={4}
              placeholder="Source, verification method, dates and response received"
              className="mt-2 w-full rounded-[1rem] border border-border bg-white/80 px-3 py-3 text-[12px] leading-relaxed outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <FindingEditor value={findings} onChange={setFindings} />
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-white/90 bg-white/90 p-3 shadow-[var(--shadow-float)] backdrop-blur-xl">
            <PrimaryButton disabled={!ready || mutation.isPending} type="submit">
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}{" "}
              Complete check
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowBlock(true)}>
              <Ban className="h-4 w-4" /> Block
            </SecondaryButton>
            <span className="ml-auto text-[9.5px] text-muted-foreground">
              Draft scoped to your signed-in user on this device
            </span>
          </div>
        </form>
      ) : null}
      {showBlock && task.status !== "COMPLETED" ? (
        <BlockerEditor
          value={blockReason}
          busy={mutation.isPending}
          onChange={setBlockReason}
          onClose={() => setShowBlock(false)}
          onSave={() =>
            mutation.mutate({
              status: "BLOCKED",
              version: task.version,
              sourceSummary: blockReason.trim(),
              findings: [],
            })
          }
        />
      ) : null}
      {task.status === "BLOCKED" ? (
        <div className="mt-5 rounded-[1.25rem] border border-critical/20 bg-critical-soft/70 p-4">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-critical-foreground">
            <AlertTriangle className="h-4 w-4" /> Work is blocked
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {task.blockerReason ?? "Dependency must be resolved before work resumes."}
          </p>
          <PrimaryButton
            onClick={() =>
              mutation.mutate({ status: "IN_PROGRESS", version: task.version, findings: [] })
            }
            disabled={mutation.isPending}
            extra="mt-3"
          >
            <Play className="h-4 w-4" /> Resume work
          </PrimaryButton>
        </div>
      ) : null}
      {task.status === "COMPLETED" ? <CompletedTask task={task} /> : null}
    </section>
  );
}
