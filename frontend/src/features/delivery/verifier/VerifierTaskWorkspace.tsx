import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Ban, CheckCircle2, ExternalLink, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { updateTask, type FindingInput, type VerificationTask } from "@/lib/api/tasks";
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
  const [result, setResult] = useState<VerifierResult>("CLEAR");
  const [sourceSummary, setSourceSummary] = useState("");
  const [findings, setFindings] = useState<FindingInput[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showBlock, setShowBlock] = useState(false);
  useEffect(() => {
    let active = true;
    void loadVerifierDraft(draftKey)
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
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady || task.status !== "IN_PROGRESS") return;
    const timer = window.setTimeout(() => {
      void saveVerifierDraft({
        key: draftKey,
        result,
        sourceSummary,
        findings,
        savedAt: new Date().toISOString(),
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draftKey, draftReady, findings, result, sourceSummary, task.status]);
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTask>[1]) => updateTask(task.id, input),
    onSuccess: async (_, input) => {
      if (input.status === "COMPLETED") void removeVerifierDraft(draftKey);
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Status status={task.status} />
            <span className="text-[10px] text-slate-400">v{task.version}</span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-950">
            {humanize(task.check.type)} verification
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {task.check.case.subject.fullName} · {task.check.case.client.displayName}
          </p>
        </div>
        <Link
          to="/cases/$caseId"
          params={{ caseId: task.check.case.publicId }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
        >
          Case 360 <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <WorkspaceInfo label="Case" value={task.check.case.caseNumber} />
        <WorkspaceInfo label="Priority" value={humanize(task.check.case.priority)} />
        <WorkspaceInfo label="Due" value={task.dueAt ? formatDate(task.dueAt) : "Not set"} />
      </div>
      {task.instructions ? (
        <WorkspaceNotice title="Assignment instructions" detail={task.instructions} />
      ) : null}
      {["OPEN", "UNASSIGNED"].includes(task.status) ? (
        <div className="mt-5 flex flex-wrap gap-2">
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
      ) : null}
      {task.status === "IN_PROGRESS" ? (
        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) complete();
          }}
        >
          <div>
            <p className="text-xs font-semibold">Verification outcome</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"] as VerifierResult[]).map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setResult(value)}
                  className={`rounded-xl border px-3 py-3 text-xs font-semibold ${result === value ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                >
                  {humanize(value)}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-xs font-semibold">
            Source summary
            <textarea
              value={sourceSummary}
              onChange={(event) => setSourceSummary(event.target.value)}
              rows={4}
              placeholder="Source, verification method, dates and response received"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <FindingEditor value={findings} onChange={setFindings} />
          <div className="flex flex-wrap items-center gap-3">
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
            <span className="text-[10px] text-slate-400">Draft saved on this device</span>
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
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" /> Work is blocked
          </p>
          <p className="mt-1 text-sm text-slate-600">
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
