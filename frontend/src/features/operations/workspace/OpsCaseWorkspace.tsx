import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CircleCheck,
  CirclePause,
  Clock3,
  TriangleAlert,
  UserRoundCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/api/auth";
import type { CaseDetail } from "@/lib/api/cases";
import { listCaseActivity } from "@/lib/backend-api/case-activity";
import { listAllUsers } from "@/lib/backend-api/users";
import { casePackageName } from "@/lib/backend-api/case-services";
import { AssignRmDialog, EscalateDialog, type CaseTarget } from "./OpsCaseDialogs";
import { StopResumeButton } from "@/features/workflow-ui/StopResume";
import { ColourChip } from "@/features/workflow-ui/ColourChip";
import { caseColour } from "@/features/workflow-ui/colour-codes";
import {
  dueState,
  humanizeCode,
  initials,
  istDateTime,
  istTime,
  caseStage,
  pendingReasons,
  pendingSince,
  pipelineSteps,
  workingWith,
} from "./ops-queue-model";

function useCan() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  return (permission: string) =>
    Boolean(session.data?.permissions.some((p) => p === "*" || p === permission));
}

/** Platform Admin oversight: may escalate, never manage. */
function useViewOnly() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  return session.data?.viewOnly === true;
}

function targetOf(item: CaseDetail): CaseTarget {
  return {
    id: item.id,
    caseNumber: item.caseNumber,
    candidate: item.subject.fullName,
    clientId: item.client.publicId,
    clientName: item.client.displayName,
    version: item.version,
    ownerId: item.assignedOpsUser?.publicId,
    ownerName: item.assignedOpsUser?.displayName,
  };
}

/** Identity, ownership, stage progression and the two Operations actions for one case. */
export function OpsCaseHeader({ item }: { item: CaseDetail }) {
  const can = useCan();
  const viewOnly = useViewOnly();
  const [dialog, setDialog] = useState<"rm" | "escalate">();
  const rms = useQuery({
    queryKey: ["users", "SPOC_RM", "all"],
    queryFn: () => listAllUsers("SPOC_RM"),
    enabled: dialog === "rm" && can("user:read"),
    staleTime: 60_000,
  });
  const stage = caseStage(item);
  const live = stage.step < pipelineSteps.length;
  const worker = workingWith(item);
  const due = dueState(item.dueAt);
  const manage = can("case:transition") && live;
  const colour = caseColour(item.checks);
  return (
    <header className="client-panel ops-case-header">
      <div className="ops-case-identity">
        <span className="ops-case-avatar" aria-hidden>
          {initials(item.subject.fullName)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1>{item.subject.fullName}</h1>
            <span className={`ops-stage-chip is-${stage.tone}`}>
              <i aria-hidden />
              {stage.label}
            </span>
            {item.priority === "URGENT" || item.priority === "HIGH" ? (
              <span className="ops-stage-chip is-critical">
                <i aria-hidden />
                {humanizeCode(item.priority)} priority
              </span>
            ) : null}
          </div>
          <p className="ops-case-sub">
            <strong>{item.caseNumber}</strong> · {item.client.displayName}
            {casePackageName(item) ? ` · ${casePackageName(item)}` : ""}
          </p>
          <dl className="ops-case-meta">
            <div>
              <dt>RM</dt>
              <dd>{item.assignedOpsUser?.displayName ?? "Not assigned"}</dd>
            </div>
            <div>
              <dt>Working with</dt>
              <dd>{live ? worker.name : "—"}</dd>
            </div>
            {live ? (
              <div className={`is-${due.tone}`}>
                <dt>
                  <Clock3 aria-hidden />
                  {due.tone === "critical" ? "Overdue by" : "Due"}
                </dt>
                <dd>{due.tone === "critical" ? due.text.replace("Overdue ", "") : due.text}</dd>
              </div>
            ) : null}
            <div>
              <dt>Updated</dt>
              <dd>{istDateTime(item.updatedAt)}</dd>
            </div>
          </dl>
        </div>
        {manage ? (
          <div className="ops-case-header-actions">
            <Button variant="outline" onClick={() => setDialog("rm")}>
              <UserRoundCog aria-hidden />
              {item.assignedOpsUser ? "Change RM" : "Assign RM"}
            </Button>
            <Button
              variant="outline"
              className="ops-escalate"
              onClick={() => setDialog("escalate")}
            >
              <TriangleAlert aria-hidden />
              Escalate
            </Button>
            <StopResumeButton
              item={{
                id: item.id,
                caseNumber: item.caseNumber,
                status: item.status,
                version: item.version,
                candidateName: item.subject.fullName,
              }}
            />
          </div>
        ) : viewOnly && live ? (
          <div className="ops-case-header-actions">
            <Button
              variant="outline"
              className="ops-escalate"
              onClick={() => setDialog("escalate")}
              disabled={Boolean(item.workflow?.escalatedAt)}
              title={item.workflow?.escalatedAt ? "Already escalated" : undefined}
            >
              <TriangleAlert aria-hidden />
              {item.workflow?.escalatedAt ? "Escalated" : "Escalate"}
            </Button>
          </div>
        ) : null}
      </div>
      {item.workflow?.escalatedAt && live ? (
        <div className="flow-callout is-warn">
          <TriangleAlert aria-hidden />
          <span>
            <strong>Escalated — handle on high priority</strong>
            {item.workflow.escalatedBy ? ` · by ${item.workflow.escalatedBy.displayName}` : ""}
            {` · ${istDateTime(item.workflow.escalatedAt)}`}
            {item.workflow.escalationNote ? ` — ${item.workflow.escalationNote}` : ""}
          </span>
        </div>
      ) : null}
      {item.status === "STOPPED" ? (
        <div className="flow-callout is-bad">
          <CirclePause aria-hidden />
          <span>
            <strong>Stopped on client instruction</strong>
            {item.workflow?.stopReason ? ` — ${item.workflow.stopReason}` : ""}
            {item.workflow?.stoppedAt ? ` · since ${istDateTime(item.workflow.stoppedAt)}` : ""}
          </span>
        </div>
      ) : null}
      {colour ? (
        <div className="ops-case-colour">
          <span className="ops-label">Current outcome</span>
          <ColourChip value={colour} />
        </div>
      ) : null}
      <ol className="ops-stepper is-wide" aria-label="Case progress">
        {[...pipelineSteps].map((label, index) => {
          const state =
            index < stage.step ? "done" : index === stage.step && live ? "current" : "pending";
          return (
            <li
              key={label}
              className={`is-${state}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span aria-hidden>{state === "done" ? <CircleCheck /> : null}</span>
              <strong>{label}</strong>
              <small>
                {state === "done" ? "Complete" : state === "current" ? "Current" : "Pending"}
              </small>
            </li>
          );
        })}
      </ol>
      {dialog === "rm" ? (
        <AssignRmDialog
          target={targetOf(item)}
          users={rms.data?.items ?? []}
          loading={rms.isPending && rms.fetchStatus !== "idle"}
          error={
            rms.isError
              ? rms.error.message
              : !can("user:read")
                ? "You do not have access to the user directory."
                : undefined
          }
          onClose={() => setDialog(undefined)}
        />
      ) : null}
      {dialog === "escalate" ? (
        <EscalateDialog
          target={targetOf(item)}
          internal={viewOnly}
          onClose={() => setDialog(undefined)}
        />
      ) : null}
    </header>
  );
}

/** Right rail: blocker, next step, ownership and the latest audited activity. */
export function OpsCaseRail({ item }: { item: CaseDetail }) {
  const stage = caseStage(item);
  const live = stage.step < pipelineSteps.length;
  const reasons = pendingReasons(item);
  const activity = useQuery({
    queryKey: ["case-activity", item.id, "", undefined],
    queryFn: () => listCaseActivity(item.id),
  });
  const reviewer = item.qaReviewer?.displayName;
  const verifiers = [
    ...new Set(
      item.checks.flatMap((check) =>
        (check.tasks ?? [])
          .filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status))
          .flatMap((task) => (task.assignee ? [task.assignee.displayName] : [])),
      ),
    ),
  ];
  return (
    <aside className="ops-case-rail" aria-label="Case status and ownership">
      <section className="client-panel">
        <h2 className="ops-card-title">
          {live && reasons.length
            ? "What is blocking this case?"
            : live
              ? "Case is moving"
              : "Case closed"}
        </h2>
        {live && reasons.length ? (
          <div className="ops-blocker">
            <TriangleAlert aria-hidden />
            <div>
              <ul>
                {reasons.map((reason) => (
                  <li key={reason.title + (reason.detail ?? "")}>
                    <strong>{reason.title}</strong>
                    {reason.detail ? <span> — {reason.detail}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="ops-since">Pending since {istDateTime(pendingSince(item))}</p>
            </div>
          </div>
        ) : null}
        <div className="ops-context-row mt-4">
          <ArrowRight aria-hidden />
          <div>
            <h3>Next step</h3>
            <p>{stage.next}</p>
          </div>
        </div>
        {live ? (
          <p className="ops-rail-note">
            Operations monitors progress and can change the RM or escalate.
          </p>
        ) : null}
      </section>
      <section className="client-panel">
        <h2 className="ops-card-title">Ownership</h2>
        <ul className="ops-owners">
          <li>
            <span className="ops-avatar" aria-hidden>
              {item.assignedOpsUser ? initials(item.assignedOpsUser.displayName) : "—"}
            </span>
            <div>
              <strong>{item.assignedOpsUser?.displayName ?? "Not assigned"}</strong>
              <small>Responsible RM</small>
            </div>
          </li>
          {verifiers.map((name) => (
            <li key={name}>
              <span className="ops-avatar" aria-hidden>
                {initials(name)}
              </span>
              <div>
                <strong>{name}</strong>
                <small>Assigned verifier</small>
              </div>
            </li>
          ))}
          {reviewer ? (
            <li>
              <span className="ops-avatar" aria-hidden>
                {initials(reviewer)}
              </span>
              <div>
                <strong>{reviewer}</strong>
                <small>QC reviewer</small>
              </div>
            </li>
          ) : null}
        </ul>
        <p className="ops-rail-note">
          Changing the RM keeps documents, work and history with the case.
        </p>
      </section>
      <section className="client-panel">
        <div className="flex items-center justify-between gap-2">
          <h2 className="ops-card-title">Recent activity</h2>
          <Link
            to="/cases/$caseId"
            params={{ caseId: item.id }}
            search={{ tab: "timeline" }}
            className="ops-link mt-0"
          >
            View all
          </Link>
        </div>
        {activity.isPending ? <p className="ops-subtle">Loading activity…</p> : null}
        {activity.isError ? <p className="ops-subtle">Activity is unavailable right now.</p> : null}
        {activity.data ? (
          activity.data.items.length ? (
            <ul className="ops-activity is-rail">
              {activity.data.items.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <time dateTime={event.createdAt}>{istTime(event.createdAt)}</time>
                  <span>
                    <strong>{event.actorName}</strong>
                    {humanizeCode(event.action.replaceAll(/[.-]/g, "_"))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ops-subtle">No recorded activity yet.</p>
          )
        ) : null}
        <p className="ops-rail-note">Times shown in IST.</p>
      </section>
    </aside>
  );
}
