import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleDot,
  ExternalLink,
  FileText,
  History,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StopResumeButton } from "@/features/workflow-ui/StopResume";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import { getCase, type CaseDetail } from "@/lib/api/cases";
import { listCaseActivity } from "@/lib/backend-api/case-activity";
import {
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

export function OpsCaseContext({
  caseId,
  canManage,
  showFullCaseLink = true,
  onClose,
  onChangeRm,
  onEscalate,
}: {
  caseId?: string;
  canManage: boolean;
  /** The full Operations case page; hidden for roles that cannot open it. */
  showFullCaseLink?: boolean;
  onClose: () => void;
  onChangeRm: (item: CaseDetail) => void;
  onEscalate: (item: CaseDetail) => void;
}) {
  const detail = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId!),
    enabled: Boolean(caseId),
  });
  if (!caseId) {
    return (
      <aside className="client-panel ops-context is-empty" aria-label="Selected case">
        <CircleDot aria-hidden />
        <h2>Select a case</h2>
        <p>
          Choose a row in the work queue to see its responsible RM, current worker, blocker and next
          step.
        </p>
      </aside>
    );
  }
  return (
    <aside className="client-panel ops-context" aria-label="Selected case">
      {detail.isPending ? <ListSkeleton rows={5} /> : null}
      {detail.isError ? (
        <ErrorState
          description={detail.error.message}
          onRetry={() => void detail.refetch()}
          retrying={detail.isFetching}
        />
      ) : null}
      {detail.data ? (
        <CaseContextBody
          item={detail.data}
          canManage={canManage}
          showFullCaseLink={showFullCaseLink}
          onClose={onClose}
          onChangeRm={() => onChangeRm(detail.data)}
          onEscalate={() => onEscalate(detail.data)}
        />
      ) : null}
    </aside>
  );
}

function CaseContextBody({
  item,
  canManage,
  showFullCaseLink,
  onClose,
  onChangeRm,
  onEscalate,
}: {
  item: CaseDetail;
  canManage: boolean;
  showFullCaseLink: boolean;
  onClose: () => void;
  onChangeRm: () => void;
  onEscalate: () => void;
}) {
  const stage = caseStage(item);
  const worker = workingWith(item);
  const reasons = pendingReasons(item);
  const live = stage.step < 6;
  const activity = useQuery({
    queryKey: ["case-activity", item.id, "", undefined],
    queryFn: () => listCaseActivity(item.id),
    // The internal audit timeline is an Operations view.
    enabled: showFullCaseLink,
  });
  const latestDocument = [...item.documents]
    .map((document) => ({ document, version: document.versions.at(-1) }))
    .filter((entry) => entry.version)
    .sort((a, b) => Date.parse(b.version!.createdAt) - Date.parse(a.version!.createdAt))[0];
  const completedChecks = item.checks.filter((check) => check.status === "COMPLETED").length;
  return (
    <>
      <header className="ops-context-head">
        <div className="min-w-0">
          <h2 title={item.subject.fullName}>{item.subject.fullName}</h2>
          <p>
            <strong>{item.caseNumber}</strong> · {item.client.displayName}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {item.priority === "URGENT" ? <span className="ops-flag">Urgent</span> : null}
          <Button variant="ghost" size="icon" aria-label="Close case details" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
      </header>
      <ol className="ops-stepper" aria-label="Case progress">
        {pipelineSteps.map((label, index) => {
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
      <div className="ops-owner-grid">
        <div>
          <p className="ops-label">Responsible RM</p>
          {item.assignedOpsUser ? (
            <div className="ops-person">
              <span className="ops-avatar" aria-hidden>
                {initials(item.assignedOpsUser.displayName)}
              </span>
              <span>{item.assignedOpsUser.displayName}</span>
            </div>
          ) : (
            <p className="ops-person is-empty">Not assigned</p>
          )}
          {canManage && live ? (
            <button type="button" className="ops-link" onClick={onChangeRm}>
              {item.assignedOpsUser ? "Change RM" : "Assign RM"}
            </button>
          ) : null}
        </div>
        <div>
          <p className="ops-label">Working with</p>
          <p className="ops-working">
            {live ? worker.name : "—"}
            {live ? <small>{worker.role}</small> : null}
          </p>
        </div>
      </div>
      {live && reasons.length ? (
        <section className="ops-blocker" aria-label="Why is this pending">
          <TriangleAlert aria-hidden />
          <div>
            <h3>Why is this pending?</h3>
            <ul>
              {reasons.slice(0, 3).map((reason) => (
                <li key={reason.title + (reason.detail ?? "")}>
                  {reason.title}
                  {reason.detail ? <span> — {reason.detail}</span> : null}
                </li>
              ))}
            </ul>
            <p className="ops-since">Pending since {istDateTime(pendingSince(item))}</p>
          </div>
        </section>
      ) : null}
      <section className="ops-context-row">
        <ArrowRight aria-hidden />
        <div>
          <h3>Next step</h3>
          <p>{stage.next}</p>
          {live ? (
            <small>Operations monitors progress and can change the RM or escalate.</small>
          ) : null}
        </div>
      </section>
      <section className="ops-context-row">
        <CircleAlert aria-hidden />
        <div>
          <h3>Checks</h3>
          <p>
            {completedChecks} of {item.checks.length} complete
            {item.dueAt ? <> · due {istDateTime(item.dueAt)}</> : null}
          </p>
        </div>
      </section>
      <section className="ops-context-row">
        <FileText aria-hidden />
        <div className="min-w-0 flex-1">
          <h3>Latest document</h3>
          {latestDocument ? (
            <div className="ops-document">
              <span className="min-w-0">
                {humanizeCode(latestDocument.document.type)} · v{latestDocument.version!.version}
                <em className={`is-${latestDocument.document.status.toLowerCase()}`}>
                  {latestDocument.document.status === "REJECTED"
                    ? "Needs replacement"
                    : humanizeCode(latestDocument.document.status)}
                </em>
              </span>
              <DocumentFileActions
                documentId={latestDocument.document.publicId}
                filename={latestDocument.version!.originalName}
                label={humanizeCode(latestDocument.document.type)}
                compact={false}
              />
            </div>
          ) : (
            <p>No documents uploaded yet.</p>
          )}
        </div>
      </section>
      {showFullCaseLink ? (
        <>
          <section className="ops-context-row">
            <History aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3>Recent activity</h3>
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: item.id }}
                  search={{ tab: "timeline" }}
                  className="ops-link"
                >
                  Full timeline
                </Link>
              </div>
              {activity.isPending ? <p>Loading activity…</p> : null}
              {activity.isError ? <p>Activity is unavailable right now.</p> : null}
              {activity.data ? (
                activity.data.items.length ? (
                  <ul className="ops-activity">
                    {activity.data.items.slice(0, 3).map((event) => (
                      <li key={event.id}>
                        <time dateTime={event.createdAt}>{istTime(event.createdAt)}</time>
                        <span>
                          {event.actorName} · {humanizeCode(event.action.replaceAll(/[.-]/g, "_"))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No recorded activity yet.</p>
                )
              ) : null}
              <small>Times shown in IST.</small>
            </div>
          </section>
        </>
      ) : null}
      <footer className="ops-context-actions">
        {showFullCaseLink ? (
          <Button asChild>
            <Link to="/cases/$caseId" params={{ caseId: item.id }}>
              <ExternalLink aria-hidden />
              Open full case
            </Link>
          </Button>
        ) : null}
        {canManage && live ? (
          <Button variant="outline" onClick={onEscalate}>
            <TriangleAlert aria-hidden />
            Escalate
          </Button>
        ) : null}
        {canManage ? (
          <StopResumeButton
            item={{
              id: item.id,
              caseNumber: item.caseNumber,
              status: item.status,
              version: item.version,
              candidateName: item.subject.fullName,
            }}
          />
        ) : null}
      </footer>
    </>
  );
}
