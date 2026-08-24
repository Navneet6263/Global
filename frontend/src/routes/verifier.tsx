import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Loader2,
  Play,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getMyTasks, updateTask, type FindingInput, type VerificationTask } from "@/lib/api/tasks";

export const Route = createFileRoute("/verifier")({
  head: () => ({ meta: [{ title: "Verifier Workbench — Sapling Global" }] }),
  component: VerifierWorkbench,
});

const filters = ["ACTIVE", "OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const;

function VerifierWorkbench() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof filters)[number]>("ACTIVE");
  const [selectedId, setSelectedId] = useState<string>();
  const queryStatus = filter === "ACTIVE" ? undefined : filter;
  const tasks = useQuery({
    queryKey: ["tasks", "mine", queryStatus],
    queryFn: () => getMyTasks(queryStatus),
  });
  const items =
    filter === "ACTIVE"
      ? (tasks.data?.items ?? []).filter((task) => task.status !== "COMPLETED")
      : (tasks.data?.items ?? []);
  const selected = items.find((task) => task.id === selectedId) ?? items[0];

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const refresh = () => void tasks.refetch();

  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onRefresh={refresh} isRefreshing={tasks.isFetching} />
        <main className="flex-1 px-4 pb-12 pt-5 sm:px-6">
          <div className="mx-auto max-w-[1500px] space-y-5">
            <header className="ink-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
              <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
              <div className="relative flex flex-wrap items-end justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                    Verification delivery
                  </p>
                  <h1 className="mt-2 text-3xl font-bold">Verifier workbench</h1>
                  <p className="mt-2 max-w-xl text-sm opacity-65">
                    Complete assigned checks with traceable source summaries, evidence-backed
                    results and structured findings.
                  </p>
                </div>
                <div className="rounded-2xl bg-primary-foreground/10 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.1em] opacity-55">Current queue</p>
                  <p className="num mt-1 text-2xl font-bold">{items.length}</p>
                </div>
              </div>
            </header>

            <div className="flex flex-wrap gap-2 pb-1">
              {filters.map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${filter === value ? "bg-primary text-primary-foreground" : "surface text-muted-foreground hover:text-foreground"}`}
                >
                  {humanize(value)}
                </button>
              ))}
            </div>

            {tasks.isError ? <ErrorState message={tasks.error.message} onRetry={refresh} /> : null}
            {tasks.isLoading ? <LoadingState /> : null}
            {!tasks.isLoading && !tasks.isError ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.7fr)_minmax(0,1.3fr)]">
                <TaskList items={items} selectedId={selected?.id} onSelect={setSelectedId} />
                {selected ? (
                  <TaskWorkspace
                    key={`${selected.id}-${selected.version}`}
                    task={selected}
                    onUpdated={async () => {
                      await queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] });
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

function TaskList({
  items,
  selectedId,
  onSelect,
}: {
  items: VerificationTask[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="surface overflow-hidden rounded-3xl">
      <div className="border-b border-[var(--hairline)] px-5 py-4">
        <h2 className="text-sm font-semibold">Assigned checks</h2>
        <p className="text-xs text-muted-foreground">Sorted by due date</p>
      </div>
      {items.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {items.map((task) => (
            <button
              key={task.id}
              onClick={() => onSelect(task.id)}
              className={`w-full px-5 py-4 text-left transition-colors ${selectedId === task.id ? "bg-accent/12" : "hover:bg-secondary/45"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {task.check.case.subject.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {task.check.case.caseNumber} · {humanize(task.check.type)}
                  </p>
                </div>
                <Status status={task.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{task.check.case.client.displayName}</span>
                <span>{task.dueAt ? formatDate(task.dueAt) : "No due date"}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-6 py-14 text-center">
          <ClipboardCheck className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Queue is clear</p>
          <p className="mt-1 text-xs text-muted-foreground">No tasks match this filter.</p>
        </div>
      )}
    </section>
  );
}

function TaskWorkspace({
  task,
  onUpdated,
}: {
  task: VerificationTask;
  onUpdated: () => Promise<void>;
}) {
  const [result, setResult] = useState<"CLEAR" | "DISCREPANCY" | "UNABLE_TO_VERIFY">("CLEAR");
  const [sourceSummary, setSourceSummary] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [showBlock, setShowBlock] = useState(false);
  const [includeFinding, setIncludeFinding] = useState(false);
  const [finding, setFinding] = useState<FindingInput>({
    kind: "OTHER",
    severity: "MEDIUM",
    title: "",
    description: "",
  });
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTask>[1]) => updateTask(task.id, input),
    onSuccess: async (_, input) => {
      toast.success(input.status === "COMPLETED" ? "Verification check completed" : "Task started");
      await onUpdated();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const canComplete =
    sourceSummary.trim().length >= 3 &&
    (!includeFinding ||
      (finding.title.trim().length >= 3 && finding.description.trim().length >= 3));

  return (
    <section className="surface rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Status status={task.status} />
            <span className="text-xs text-muted-foreground">v{task.version}</span>
          </div>
          <h2 className="mt-3 text-2xl font-bold">{humanize(task.check.type)} verification</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.check.case.subject.fullName} · {task.check.case.client.displayName}
          </p>
        </div>
        <Link
          to="/cases/$caseId"
          params={{ caseId: task.check.case.publicId }}
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold hover:bg-secondary/75"
        >
          Case 360 <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Info icon={Clock3} label="Due" value={task.dueAt ? formatDate(task.dueAt) : "Not set"} />
        <Info icon={ShieldAlert} label="Priority" value={humanize(task.check.case.priority)} />
        <Info icon={ClipboardCheck} label="Case" value={task.check.case.caseNumber} />
      </div>

      {task.instructions ? (
        <div className="mt-5 rounded-2xl border border-info/15 bg-info/5 p-4">
          <p className="text-xs font-semibold text-info">Instructions</p>
          <p className="mt-1 text-sm leading-6">{task.instructions}</p>
        </div>
      ) : null}

      {task.status === "OPEN" ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ status: "IN_PROGRESS", version: task.version, findings: [] })
            }
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Play className="h-4 w-4" /> Start verification
          </button>
          <button
            type="button"
            onClick={() => setShowBlock((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold"
          >
            <Ban className="h-4 w-4" /> Record blocker
          </button>
        </div>
      ) : null}

      {task.status === "IN_PROGRESS" ? (
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canComplete) return;
            mutation.mutate({
              status: "COMPLETED",
              version: task.version,
              result,
              sourceSummary: sourceSummary.trim(),
              findings: includeFinding
                ? [
                    {
                      ...finding,
                      title: finding.title.trim(),
                      description: finding.description.trim(),
                    },
                  ]
                : [],
            });
          }}
        >
          <div>
            <label className="text-xs font-semibold">Verification result</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => {
                    setResult(value);
                    if (value === "DISCREPANCY") setIncludeFinding(true);
                  }}
                  className={`rounded-2xl border px-3 py-3 text-xs font-semibold ${result === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                >
                  {humanize(value)}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold">Source summary</span>
            <textarea
              value={sourceSummary}
              onChange={(event) => setSourceSummary(event.target.value)}
              rows={5}
              placeholder="Record the source consulted, verification method, dates and response received…"
              className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl bg-secondary/45 p-4 text-sm font-medium">
            <input
              type="checkbox"
              checked={includeFinding}
              onChange={(event) => setIncludeFinding(event.target.checked)}
              className="h-4 w-4"
            />
            Add a structured finding
          </label>
          {includeFinding ? <FindingForm value={finding} onChange={setFinding} /> : null}
          <button
            disabled={!canComplete || mutation.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}{" "}
            Complete check
          </button>
        </form>
      ) : null}

      {["OPEN", "IN_PROGRESS"].includes(task.status) && showBlock ? (
        <div className="mt-5 rounded-2xl border border-warning/25 bg-warning/5 p-4">
          <label className="block">
            <span className="text-xs font-semibold">Blocking reason</span>
            <textarea
              value={blockReason}
              onChange={(event) => setBlockReason(event.target.value)}
              rows={3}
              placeholder="State the unavailable source, dependency or evidence needed to continue."
              className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
            />
          </label>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowBlock(false)}
              className="rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={blockReason.trim().length < 3 || mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  status: "BLOCKED",
                  version: task.version,
                  sourceSummary: blockReason.trim(),
                  findings: [],
                })
              }
              className="inline-flex items-center gap-2 rounded-full bg-warning px-4 py-2 text-xs font-semibold text-warning-foreground disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" /> Block task
            </button>
          </div>
        </div>
      ) : null}

      {task.status === "BLOCKED" ? (
        <div className="mt-6 rounded-2xl border border-warning/25 bg-warning/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Verification is blocked</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {task.check.sourceSummary ?? "A dependency must be resolved before work resumes."}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ status: "IN_PROGRESS", version: task.version, findings: [] })
            }
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Play className="h-4 w-4" /> Resume verification
          </button>
        </div>
      ) : null}

      {task.status === "COMPLETED" ? (
        <div className="mt-6 rounded-2xl bg-accent/15 p-5">
          <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
          <p className="mt-2 text-sm font-semibold">This task is complete</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The result is available in Case 360 and the QA workflow.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function FindingForm({
  value,
  onChange,
}: {
  value: FindingInput;
  onChange: (value: FindingInput) => void;
}) {
  return (
    <div className="rounded-3xl border border-warning/25 bg-warning/5 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning-foreground" />
        <p className="text-sm font-semibold">Finding details</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select
          label="Category"
          value={value.kind}
          options={[
            "IDENTITY_MISMATCH",
            "DATE_MISMATCH",
            "ADDRESS_MISMATCH",
            "RECORD_FOUND",
            "OTHER",
          ]}
          onChange={(kind) => onChange({ ...value, kind: kind as FindingInput["kind"] })}
        />
        <Select
          label="Severity"
          value={value.severity}
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
          onChange={(severity) =>
            onChange({ ...value, severity: severity as FindingInput["severity"] })
          }
        />
      </div>
      <label className="mt-4 block text-xs font-semibold">
        Title
        <input
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        />
      </label>
      <label className="mt-4 block text-xs font-semibold">
        Description
        <textarea
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          rows={4}
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
function Info({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/45 p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
function Status({ status }: { status: string }) {
  const done = status === "COMPLETED";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${done ? "bg-accent/25 text-accent-foreground" : status === "IN_PROGRESS" ? "bg-info/10 text-info" : "bg-warning/20 text-warning-foreground"}`}
    >
      {humanize(status)}
    </span>
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
        <p className="mt-3 font-semibold">No task selected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an assigned check from the queue.
        </p>
      </div>
    </section>
  );
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="surface rounded-3xl p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
      <p className="mt-3 font-semibold">Task queue could not be loaded</p>
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
