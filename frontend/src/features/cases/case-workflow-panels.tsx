import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ClipboardCheck,
  Copy,
  FileCheck2,
  Play,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { InfoRow, Panel, Status } from "@/features/cases/case-detail-ui";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { getSession } from "@/lib/api/auth";
import { issueCandidateAccess } from "@/lib/api/candidate-portal";
import { transitionCase, type CaseDetail } from "@/lib/api/cases";
import { createTask } from "@/lib/api/tasks";
import { listAllUsers } from "@/lib/api/users";
import { CaseMethodsDialog } from "./case-methods-dialog";

export function CaseActions({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canTransition =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("case:transition");
  const mutation = useMutation({
    mutationFn: () =>
      transitionCase(item.id, {
        status: "IN_PROGRESS",
        version: item.version,
        reason: "Verification work authorised and started",
      }),
    onSuccess: () => {
      toast.success("Verification started");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["operations"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (item.status !== "DOCUMENT_PENDING" || !canTransition) return null;

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-accent/30 bg-accent/10 px-5 py-4">
      <div>
        <p className="text-sm font-semibold">Consent received</p>
        <p className="text-xs text-muted-foreground">
          Start verification to unlock check assignment and execution.
        </p>
      </div>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        aria-busy={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        {mutation.isPending ? "Starting…" : "Start verification"}
      </button>
    </section>
  );
}

export function CandidatePanel({ item }: { item: CaseDetail }) {
  const [shareUrl, setShareUrl] = useState("");
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canIssue =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("case:create");
  const mutation = useMutation({
    mutationFn: () => issueCandidateAccess(item.id),
    onSuccess: (result) => {
      const url = `${window.location.origin}/candidate/${result.id}#token=${encodeURIComponent(result.token)}`;
      setShareUrl(url);
      toast.success("Secure candidate link issued", {
        description: result.delivery.queued
          ? `${result.delivery.channel} delivery queued to ${result.delivery.destination} · expires ${formatDateTime(result.expiresAt)}`
          : `Copy and share securely · expires ${formatDateTime(result.expiresAt)}`,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Panel title="Candidate" subtitle="Case subject and secure self-service access">
      <InfoRow icon={UserRound} label="Name" value={item.subject.fullName} />
      <InfoRow
        icon={FileCheck2}
        label="Employee code"
        value={item.subject.employeeCode || "Not provided"}
      />
      <InfoRow icon={Building2} label="Client" value={item.client.displayName} />
      {canIssue ? (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          aria-busy={mutation.isPending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {mutation.isPending
            ? "Issuing…"
            : shareUrl
              ? "Rotate secure link"
              : "Issue candidate portal link"}
        </button>
      ) : null}
      {shareUrl ? (
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={shareUrl}
            className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(shareUrl)
                .then(() => toast.success("Candidate link copied"))
                .catch(() => toast.error("Copy failed"));
            }}
            aria-label="Copy candidate portal link"
            className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

export function CheckCard({
  caseId,
  caseStatus,
  check,
}: {
  caseId: string;
  caseStatus: string;
  check: CaseDetail["checks"][number];
}) {
  const queryClient = useQueryClient();
  const [assigneeId, setAssigneeId] = useState("");
  const [instructions, setInstructions] = useState("");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canAssign =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("task:write");
  const task = check.tasks?.[0];
  const directory = useQuery({
    queryKey: ["users", "VERIFIER"],
    queryFn: () => listAllUsers("VERIFIER"),
    enabled: Boolean(canAssign && caseStatus === "IN_PROGRESS" && !task),
    staleTime: 60_000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      createTask(check.publicId, {
        assigneeId,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success(`${humanize(check.type)} assigned`);
      setInstructions("");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <article className="rounded-2xl border border-[var(--hairline)] bg-secondary/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{humanize(check.type)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {check.result ? `Result: ${humanize(check.result)}` : "Result pending"}
          </p>
        </div>
        <Status status={check.status} />
      </div>

      {task ? (
        <div className="mt-4 rounded-xl bg-background/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Assigned verifier
          </p>
          <p className="mt-1 text-sm font-medium">
            {task.assignee?.displayName ?? "Awaiting assignment"}
          </p>
          {task.instructions ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.instructions}</p>
          ) : null}
        </div>
      ) : null}

      {check.sourceSummary ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{check.sourceSummary}</p>
      ) : null}
      <CaseMethodsDialog
        caseId={caseId}
        checkId={check.publicId}
        checkType={check.type}
        checkStatus={check.status}
      />

      {!task && canAssign && caseStatus === "IN_PROGRESS" ? (
        <div className="mt-4 space-y-2.5 border-t border-[var(--hairline)] pt-4">
          <select
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            aria-label={`Assign verifier for ${humanize(check.type)}`}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
          >
            <option value="">
              {directory.isLoading ? "Loading verifiers…" : "Select verifier"}
            </option>
            {directory.data?.items.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} · {user.email}
              </option>
            ))}
          </select>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Verification instructions (optional)"
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
          />
          {directory.isError ? (
            <p className="text-xs text-destructive">{directory.error.message}</p>
          ) : directory.data && directory.data.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No active verifier is configured. Add one in user management first.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!assigneeId || mutation.isPending}
            aria-busy={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            {mutation.isPending ? "Assigning…" : "Assign check"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
