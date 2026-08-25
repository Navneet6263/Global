import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getQaQueue, submitQaDecision, type QaQueueItem } from "@/lib/api/qa";

export const Route = createFileRoute("/qa-review")({
  head: () => ({ meta: [{ title: "QA Review Workspace — Sapling Global" }] }),
  component: QaWorkspace,
});

const requiredChecklist = [
  "Candidate identity and case scope verified",
  "All check results and source summaries reviewed",
  "Supporting evidence is complete and readable",
  "Discrepancies and risk ratings are consistent",
  "Report language is factual and non-discriminatory",
];

function QaWorkspace() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const queue = useQuery({ queryKey: ["qa", "queue"], queryFn: getQaQueue });
  const items = queue.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onRefresh={() => void queue.refetch()} isRefreshing={queue.isFetching} />
        <main className="flex-1 px-4 pb-12 pt-5 sm:px-6">
          <div className="mx-auto max-w-[1500px] space-y-5">
            <header className="ink-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
              <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
              <div className="relative flex flex-wrap items-end justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                    Independent quality gate
                  </p>
                  <h1 className="mt-2 text-3xl font-bold">QA review</h1>
                  <p className="mt-2 max-w-xl text-sm opacity-65">
                    Review completed checks, verify evidence integrity and release only defensible
                    verification outcomes.
                  </p>
                </div>
                <div className="rounded-2xl bg-primary-foreground/10 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.1em] opacity-55">
                    Awaiting review
                  </p>
                  <p className="num mt-1 text-2xl font-bold">{items.length}</p>
                </div>
              </div>
            </header>

            {queue.isLoading ? <LoadingState /> : null}
            {queue.isError ? (
              <ErrorState message={queue.error.message} onRetry={() => void queue.refetch()} />
            ) : null}
            {!queue.isLoading && !queue.isError ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.7fr)_minmax(0,1.3fr)]">
                <QaList items={items} selectedId={selected?.id} onSelect={setSelectedId} />
                {selected ? (
                  <ReviewPanel
                    key={`${selected.id}-${selected.version}`}
                    item={selected}
                    onComplete={async () => {
                      await queryClient.invalidateQueries({ queryKey: ["qa", "queue"] });
                      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                    }}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function QaList({
  items,
  selectedId,
  onSelect,
}: {
  items: QaQueueItem[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="surface overflow-hidden rounded-3xl">
      <div className="border-b border-[var(--hairline)] px-5 py-4">
        <h2 className="text-sm font-semibold">Review queue</h2>
        <p className="text-xs text-muted-foreground">Oldest due cases first</p>
      </div>
      {items.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full px-5 py-4 text-left ${selectedId === item.id ? "bg-accent/12" : "hover:bg-secondary/45"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.subject.fullName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.caseNumber} · {item.client.displayName}
                  </p>
                </div>
                <span className="rounded-full bg-warning/20 px-2.5 py-1 text-[10px] font-semibold text-warning-foreground">
                  QA review
                </span>
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                <span>{item.checks.length} completed checks</span>
                <span>{item.dueAt ? formatDate(item.dueAt) : "No due date"}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-6 py-14 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-accent-foreground" />
          <p className="mt-3 text-sm font-semibold">Review queue is clear</p>
          <p className="mt-1 text-xs text-muted-foreground">No cases are waiting for QA.</p>
        </div>
      )}
    </section>
  );
}

function ReviewPanel({ item, onComplete }: { item: QaQueueItem; onComplete: () => Promise<void> }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [reworkIds, setReworkIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"APPROVED" | "REWORK">("APPROVED");
  const mutation = useMutation({
    mutationFn: () =>
      submitQaDecision(item.id, {
        decision: mode,
        caseVersion: item.version,
        checklist: checked,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        reworkCheckIds: mode === "REWORK" ? reworkIds : [],
      }),
    onSuccess: async () => {
      toast.success(
        mode === "APPROVED" ? "Case approved and report queued" : "Case returned for rework",
      );
      await onComplete();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const ready =
    checked.length === requiredChecklist.length &&
    notes.trim().length >= 3 &&
    (mode === "APPROVED" || reworkIds.length > 0);

  return (
    <section className="surface rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-info/10 px-2.5 py-1 text-[10px] font-semibold text-info">
              {humanize(item.priority)}
            </span>
            <span className="text-xs text-muted-foreground">v{item.version}</span>
          </div>
          <h2 className="mt-3 text-2xl font-bold">{item.subject.fullName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.caseNumber} · {item.client.displayName}
          </p>
        </div>
        <Link
          to="/cases/$caseId"
          params={{ caseId: item.id }}
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold"
        >
          Case 360 <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {item.checks.map((check) => (
          <div
            key={check.publicId}
            className="rounded-2xl border border-[var(--hairline)] bg-secondary/35 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{humanize(check.type)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {check.result ? humanize(check.result) : "Result unavailable"}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${check.riskLevel === "HIGH" || check.riskLevel === "CRITICAL" ? "bg-destructive/10 text-destructive" : "bg-success text-success-foreground"}`}
              >
                {humanize(check.riskLevel ?? "unclassified")}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <h3 className="text-sm font-semibold">Quality checklist</h3>
        <div className="mt-3 space-y-2">
          {requiredChecklist.map((label) => {
            const active = checked.includes(label);
            return (
              <label
                key={label}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm ${active ? "border-accent bg-accent/10" : "border-border"}`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() =>
                    setChecked((current) =>
                      active ? current.filter((value) => value !== label) : [...current, label],
                    )
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <label className="mt-5 block">
        <span className="text-xs font-semibold">Reviewer notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          placeholder="Record the reasoning for approval or the exact correction required…"
          className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
        />
      </label>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("APPROVED")}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${mode === "APPROVED" ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}
        >
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => setMode("REWORK")}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${mode === "REWORK" ? "border-warning bg-warning/20 text-warning-foreground" : "border-border"}`}
        >
          <RotateCcw className="mr-2 inline h-4 w-4" />
          Return for rework
        </button>
      </div>
      {mode === "REWORK" ? (
        <div className="mt-4 rounded-2xl bg-warning/8 p-4">
          <p className="text-xs font-semibold">Select checks requiring rework</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.checks.map((check) => {
              const active = reworkIds.includes(check.publicId);
              return (
                <button
                  type="button"
                  key={check.publicId}
                  onClick={() =>
                    setReworkIds((current) =>
                      active
                        ? current.filter((id) => id !== check.publicId)
                        : [...current, check.publicId],
                    )
                  }
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${active ? "bg-warning text-warning-foreground" : "bg-background"}`}
                >
                  {humanize(check.type)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <button
        onClick={() => mutation.mutate()}
        disabled={!ready || mutation.isPending}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === "APPROVED" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        Submit QA decision
      </button>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="surface h-96 animate-pulse rounded-3xl" />
      <div className="surface h-96 animate-pulse rounded-3xl xl:col-span-2" />
    </div>
  );
}
function EmptyState() {
  return (
    <section className="surface grid min-h-96 place-items-center rounded-3xl p-8 text-center">
      <div>
        <ClipboardCheck className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-3 font-semibold">No case selected</p>
        <p className="mt-1 text-sm text-muted-foreground">Choose a case from the QA queue.</p>
      </div>
    </section>
  );
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="surface rounded-3xl p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
      <p className="mt-3 font-semibold">QA queue could not be loaded</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </section>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
