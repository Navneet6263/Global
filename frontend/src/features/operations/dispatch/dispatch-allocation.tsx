import { useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, UsersRound } from "lucide-react";
import type { DispatchCase, DispatchProgress, DispatchVerifier } from "./dispatch-api";

type Props = {
  cases: DispatchCase[];
  verifiers: DispatchVerifier[];
  allocations: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled: boolean;
  progress: Record<string, DispatchProgress>;
  onOpenCase: (id: string) => void;
};

function VerifierSelect({
  label,
  members,
  value,
  onChange,
  disabled,
}: {
  label: string;
  members: DispatchVerifier[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full min-w-0 rounded-2xl border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
    >
      <option value="">Choose verifier</option>
      {members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name} · {member.email} · {member.activeChecks} active / {member.overdue} overdue
        </option>
      ))}
    </select>
  );
}

export function DispatchAllocation({
  cases,
  verifiers,
  allocations,
  onChange,
  disabled,
  progress,
  onOpenCase,
}: Props) {
  const [mode, setMode] = useState<"case" | "all" | "check">("case");
  const pending = cases.filter(
    (record) => record.ready && progress[record.id]?.status !== "success",
  );
  const assign = (records: DispatchCase[], verifierId: string) =>
    onChange({
      ...allocations,
      ...Object.fromEntries(
        records.flatMap((record) => record.checks.map((check) => [check.id, verifierId])),
      ),
    });
  const commonValue = (records: DispatchCase[]) => {
    const values = new Set(
      records.flatMap((record) => record.checks.map((check) => allocations[check.id] ?? "")),
    );
    return values.size === 1 ? [...values][0]! : "";
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <UsersRound className="size-4 text-primary" /> Allocate verification checks
        </h3>
        <select
          aria-label="Allocation mode"
          value={mode}
          disabled={disabled}
          onChange={(event) => setMode(event.target.value as typeof mode)}
          className="rounded-full border border-border bg-muted/40 px-4 py-2 text-sm"
        >
          <option value="case">One verifier per case</option>
          <option value="all">Same verifier for all</option>
          <option value="check">Split by check</option>
        </select>
      </div>
      {mode === "all" && pending.length > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="mb-2 text-sm">
            Apply to every ready case. Only verifiers eligible for all selected scopes are listed.
          </p>
          <VerifierSelect
            label="Verifier for all ready cases"
            members={verifiers.filter((member) =>
              pending.every((record) => record.eligibleVerifierIds.includes(member.id)),
            )}
            value={commonValue(pending)}
            onChange={(id) => assign(pending, id)}
            disabled={disabled}
          />
        </div>
      ) : null}
      {cases.map((record) => {
        const state = progress[record.id];
        const done = state?.status === "success";
        const members = verifiers.filter((member) =>
          record.eligibleVerifierIds.includes(member.id),
        );
        return (
          <section
            key={record.id}
            aria-label={`Allocation for ${record.candidateName}`}
            className={`rounded-3xl border p-4 sm:p-5 ${done ? "border-emerald-200 bg-emerald-50/50" : record.ready ? "border-border bg-white" : "border-amber-200 bg-amber-50/40"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-semibold">{record.candidateName}</h4>
                <p className="break-words text-xs text-muted-foreground">
                  {record.caseNumber} · {record.clientName} · {record.branchName}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${done || record.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
              >
                {done
                  ? "Assigned"
                  : record.ready
                    ? record.status === "IN_PROGRESS"
                      ? "Assignment pending"
                      : "Ready to start"
                    : "Needs attention"}
              </span>
            </div>
            {!record.ready && !done ? (
              <div className="mt-3 text-sm text-amber-950">
                <ul className="list-disc space-y-1 pl-4">
                  {record.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={disabled}
                  className="mt-3 font-semibold underline underline-offset-4"
                  onClick={() => onOpenCase(record.id)}
                >
                  Review this case
                </button>
              </div>
            ) : null}
            {record.ready && !done ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {record.checks.length} unassigned checks · existing owners stay unchanged
                </p>
                {mode === "check" ? (
                  record.checks.map((check) => (
                    <div
                      key={check.id}
                      className="grid items-center gap-2 sm:grid-cols-[150px_minmax(0,1fr)]"
                    >
                      <span className="text-xs font-medium">{check.type.replaceAll("_", " ")}</span>
                      <VerifierSelect
                        label={`Verifier for ${record.caseNumber} ${check.type}`}
                        members={members}
                        value={allocations[check.id] ?? ""}
                        disabled={disabled}
                        onChange={(id) => onChange({ ...allocations, [check.id]: id })}
                      />
                    </div>
                  ))
                ) : (
                  <VerifierSelect
                    label={`Verifier for ${record.caseNumber}`}
                    members={members}
                    value={commonValue([record])}
                    disabled={disabled}
                    onChange={(id) => assign([record], id)}
                  />
                )}
              </div>
            ) : null}
            {state ? (
              <div
                role="status"
                className={`mt-3 flex items-start gap-2 text-sm ${state.status === "error" ? "text-red-700" : "text-emerald-800"}`}
              >
                {state.status === "saving" ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
                ) : done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                ) : state.status === "error" ? (
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                ) : null}
                <span>
                  {done
                    ? `${state.assigned} checks assigned successfully`
                    : state.status === "saving"
                      ? "Saving start and assignments together…"
                      : state.status === "waiting"
                        ? "Waiting to process…"
                        : state.message}
                </span>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export function DispatchWorkload({
  verifiers,
  cases,
  allocations,
  progress,
}: Pick<Props, "verifiers" | "cases" | "allocations" | "progress">) {
  const counts = new Map<string, number>();
  cases
    .filter((record) => record.ready)
    .forEach((record) =>
      record.checks.forEach((check) => {
        const id = allocations[check.id];
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }),
    );
  if (!counts.size) return null;
  return (
    <section className="rounded-3xl border border-sky-200 bg-sky-50/50 p-4">
      <h3 className="text-sm font-semibold">Workload impact</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Active checks in your authorised workspace at preview time; assignments are not a capacity
        reservation.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {verifiers
          .filter((member) => counts.has(member.id))
          .map((member) => {
            const extra = counts.get(member.id) ?? 0;
            const saved = cases
              .filter((record) => progress[record.id]?.status === "success")
              .reduce(
                (sum, record) =>
                  sum + record.checks.filter((check) => allocations[check.id] === member.id).length,
                0,
              );
            return (
              <div key={member.id} className="min-w-0 rounded-2xl bg-white p-3 text-sm">
                <p className="truncate font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                <p className="mt-2">
                  {member.activeChecks} active + {extra} selected ={" "}
                  <strong>{member.activeChecks + extra} projected</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  {member.overdue} overdue · {saved} assigned in this batch
                </p>
              </div>
            );
          })}
      </div>
    </section>
  );
}
