import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { getRmQueue, getTeamQueue, type RmBucket } from "@/lib/backend-api/workflow";
import {
  dueLabel,
  flowPosition,
  readableCheck,
  sinceLabel,
} from "@/features/workflow-ui/flow-model";
import { navigationCountsQuery } from "../workspace/ops-workspace-api";
import { initials } from "../workspace/ops-queue-model";

type Step = RmBucket | "needs_rm" | "team";
type Tone = "action" | "waiting" | "progress" | "review";

const steps: Array<{ value: Step; label: string; hint: string; tone: Tone }> = [
  { value: "needs_rm", label: "Needs RM", hint: "Operations assigns", tone: "action" },
  { value: "needs_data_entry", label: "Assign Data Entry", hint: "RM to act", tone: "action" },
  {
    value: "with_data_entry",
    label: "With Data Entry",
    hint: "Completeness review",
    tone: "progress",
  },
  { value: "correction", label: "Correction (L1)", hint: "Candidate / client", tone: "waiting" },
  { value: "ready", label: "Ready to route", hint: "RM to act", tone: "action" },
  { value: "team", label: "Waiting for TL", hint: "Member not assigned", tone: "waiting" },
  { value: "qc", label: "In QC", hint: "Independent review", tone: "review" },
  { value: "final_approval", label: "Final approval", hint: "RM decision", tone: "action" },
];

/**
 * Where every new-flow case is waiting right now: one proportional bar, the steps as
 * tabs, and the cases at the chosen step. Counts come from the RM and Team Leader queues.
 */
export function FlowPipelinePanel() {
  const [choice, setChoice] = useState<Step>();
  const counts = useQuery(navigationCountsQuery);
  const rm = useQuery({
    queryKey: ["workflow", "rm-queue", "ops-pipeline"],
    queryFn: ({ signal }) => getRmQueue({ pageSize: 1 }, signal),
    refetchInterval: 60_000,
  });
  const team = useQuery({
    queryKey: ["workflow", "team-queue", "ops-pipeline"],
    queryFn: ({ signal }) => getTeamQueue({ view: "unassigned", pageSize: 8 }, signal),
    refetchInterval: 60_000,
  });

  const countOf = (step: Step) =>
    step === "needs_rm"
      ? counts.data?.counts.opsUnassigned
      : step === "team"
        ? team.data?.counts.unassigned
        : rm.data?.counts[step];
  // Open the first step that has work waiting, unless the user picked one.
  const selected: Step =
    choice ?? steps.find((step) => (countOf(step.value) ?? 0) > 0)?.value ?? "ready";
  const active = steps.find((step) => step.value === selected)!;
  const bucket = selected !== "needs_rm" && selected !== "team" ? selected : undefined;
  const list = useQuery({
    queryKey: ["workflow", "rm-queue", "ops-pipeline", bucket],
    queryFn: ({ signal }) => getRmQueue({ bucket, pageSize: 8 }, signal),
    enabled: Boolean(bucket),
  });
  const total = steps.reduce((sum, step) => sum + (countOf(step.value) ?? 0), 0);

  return (
    <section className="attn-card" aria-label="Flow pipeline">
      <header className="attn-card-head">
        <div>
          <h2>Where cases are waiting</h2>
          <p>RM → Data Entry → Ready → departments → QC → RM approval</p>
        </div>
      </header>
      {total ? (
        <div className="attn-flowbar" aria-hidden>
          {steps.map((step) =>
            countOf(step.value) ? (
              <i
                key={step.value}
                className={`attn-tone-${step.tone}`}
                style={{ flexGrow: countOf(step.value) }}
                title={`${step.label}: ${countOf(step.value)}`}
              />
            ) : null,
          )}
        </div>
      ) : null}
      {rm.isError ? (
        <div className="px-5 pt-3">
          <ErrorState
            description={rm.error.message}
            onRetry={() => void rm.refetch()}
            retrying={rm.isFetching}
          />
        </div>
      ) : null}
      <div className="attn-steps" role="group" aria-label="Flow steps">
        {steps.map((step) => {
          const count = countOf(step.value);
          return (
            <button
              key={step.value}
              type="button"
              aria-pressed={selected === step.value}
              className={`attn-step ${count ? "" : "is-zero"}`}
              onClick={() => setChoice(step.value)}
              title={step.hint}
            >
              <small>
                <i className={`attn-tone-${step.tone}`} aria-hidden />
                {step.label}
              </small>
              <strong>{count ?? "—"}</strong>
            </button>
          );
        })}
      </div>

      {selected === "needs_rm" ? (
        <p className="attn-step-note">
          {active.hint}: assign a responsible RM from the{" "}
          <Link to="/operations" search={{ view: "needs-rm" }} className="ops-link">
            work queue
          </Link>
          .
        </p>
      ) : null}

      {selected === "team" ? (
        team.isPending ? (
          <div className="p-4">
            <ListSkeleton rows={3} />
          </div>
        ) : team.data?.items.length ? (
          <ul className="attn-rows" aria-label="Checks waiting for a Team Leader">
            {team.data.items.map((task) => {
              const due = dueLabel(task.dueAt);
              return (
                <li key={task.id} className={`attn-row ${due.tone === "bad" ? "is-overdue" : ""}`}>
                  <span className="attn-avatar" aria-hidden>
                    {initials(task.case.candidateName)}
                  </span>
                  <span className="attn-row-who">
                    <strong>{task.case.candidateName}</strong>
                    <small>
                      {task.case.clientName} · {task.case.caseNumber}
                    </small>
                  </span>
                  <span className="attn-row-mid">
                    <span>
                      <i className="attn-dot is-warn" aria-hidden />
                      {readableCheck(task.check.type)} · {task.check.department?.name ?? "—"} team
                    </span>
                    <small>routed {sinceLabel(task.check.routedAt)} ago</small>
                  </span>
                  <span className={`attn-row-due is-${due.tone}`}>{due.text}</span>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: task.case.id }}
                    className="attn-go"
                    aria-label={`Open ${task.case.caseNumber}`}
                  >
                    Open <ChevronRight aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="attn-step-note">Every routed check has a team member.</p>
        )
      ) : null}

      {bucket ? (
        list.isPending ? (
          <div className="p-4">
            <ListSkeleton rows={3} />
          </div>
        ) : list.data?.items.length ? (
          <ul className="attn-rows" aria-label={`${active.label} cases`}>
            {list.data.items.map((item) => {
              const position = flowPosition(item);
              const due = dueLabel(item.dueAt);
              return (
                <li key={item.id} className={`attn-row ${due.tone === "bad" ? "is-overdue" : ""}`}>
                  <span className="attn-avatar" aria-hidden>
                    {initials(item.candidateName)}
                  </span>
                  <span className="attn-row-who">
                    <strong>{item.candidateName}</strong>
                    <small>
                      {item.client.name} · {item.caseNumber}
                    </small>
                  </span>
                  <span className="attn-row-mid">
                    <span>
                      <i className={`attn-dot is-${position.tone}`} aria-hidden />
                      {position.label} · {position.holder}
                    </span>
                    <small>
                      RM {item.rm?.name ?? "—"} · updated {sinceLabel(item.updatedAt)} ago
                    </small>
                  </span>
                  <span className={`attn-row-due is-${due.tone}`}>{due.text}</span>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: item.id }}
                    className="attn-go"
                    aria-label={`Open ${item.caseNumber}`}
                  >
                    Open <ChevronRight aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="attn-step-note">No case is waiting at this step.</p>
        )
      ) : null}
    </section>
  );
}
