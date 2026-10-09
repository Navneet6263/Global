import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Inbox,
  ListChecks,
  MessageSquareText,
  MessageSquareWarning,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import { getSession } from "@/lib/api/auth";
import { getCase, type CaseDetail } from "@/lib/api/cases";
import {
  createClarification,
  listClarifications,
  resolveClarification,
} from "@/lib/backend-api/clarifications";
import { getEvidenceReadiness, reviewDocument } from "@/lib/backend-api/documents";
import {
  getDataEntryOverview,
  getDataEntryQueue,
  getInitiationForms,
  markCaseReady,
  type QueueCase,
} from "@/lib/backend-api/workflow";
import { CheckInitiation } from "./CheckInitiation";
import { istDateTime } from "@/features/operations/workspace/ops-queue-model";
import { dueLabel, readableCheck, sinceLabel } from "./flow-model";
import { AssignDataEntryDialog } from "./RmDialogs";
import { StatCard as Stat } from "@/components/workspace/kit";

export interface DataEntrySearch {
  view?: "mine" | "team";
  q?: string;
  page?: number;
  caseId?: string;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export function DataEntryWorkspace({
  search,
  onChange,
}: {
  search: DataEntrySearch;
  onChange: (patch: Partial<DataEntrySearch>, replace?: boolean) => void;
}) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const isLead = Boolean(
    session.data?.departments?.some((d) => d.kind === "DATA_ENTRY" && d.role === "LEAD"),
  );
  const view = search.view === "team" && isLead ? "team" : "mine";
  const page = search.page ?? 1;
  const [input, setInput] = useState(search.q ?? "");
  const [reassign, setReassign] = useState<QueueCase>();
  useEffect(() => setInput(search.q ?? ""), [search.q]);
  const queue = useQuery({
    queryKey: ["workflow", "data-entry", view, search.q ?? "", page],
    queryFn: ({ signal }) =>
      getDataEntryQueue({ view, search: search.q, page, pageSize: 10 }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const overview = useQuery({
    queryKey: ["workflow", "data-entry", "overview", "mine"],
    queryFn: ({ signal }) => getDataEntryOverview("mine", signal),
    refetchInterval: 60_000,
    retry: false,
  });
  const pages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / 10));
  const kpis = overview.data?.kpis;
  return (
    <div className="rmo dei">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Intake summary">
        <Stat
          icon={Inbox}
          tone="info"
          label="To review"
          value={queue.data?.counts["mine"] ?? "—"}
          hint="Assigned to you"
        />
        <Stat
          icon={MessageSquareWarning}
          tone="action"
          label="Waiting on correction"
          value={queue.data?.counts["correction"] ?? "—"}
          hint="Candidate or client to reply"
        />
        <Stat
          icon={TriangleAlert}
          tone={kpis?.overdue ? "bad" : "neutral"}
          label="Past due"
          value={kpis ? kpis.overdue : "—"}
          hint="Over the due date"
        />
        <Stat
          icon={ClipboardCheck}
          tone="good"
          label="Marked Ready today"
          value={kpis ? kpis.readyToday : "—"}
          hint="Sent back to the RM"
        />
      </section>
      <section className="rmo-card dei-queue" aria-label="Data Entry queue">
        <header className="dei-queue-head">
          <div>
            <h2>
              {view === "team" ? "Team cases" : "My cases"}
              <span className="dei-count">{queue.data?.total ?? 0}</span>
            </h2>
            <p>Open a case, check documents, initiate checks, then mark Ready.</p>
          </div>
          {isLead ? (
            <div className="ops-segment" role="group" aria-label="Queue">
              <button
                type="button"
                aria-pressed={view === "mine"}
                onClick={() => onChange({ view: undefined, page: undefined })}
              >
                My work
              </button>
              <button
                type="button"
                aria-pressed={view === "team"}
                onClick={() => onChange({ view: "team", page: undefined })}
              >
                Team
              </button>
            </div>
          ) : null}
        </header>
        <form
          className="dei-search"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ q: input.trim() || undefined, page: undefined });
          }}
        >
          <Search aria-hidden />
          <input
            type="search"
            value={input}
            maxLength={120}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search candidate, Sapling ID or company"
            aria-label="Search intake"
          />
          <button type="submit" aria-label="Search">
            Search
          </button>
        </form>
        <div className="dei-status" role="status" aria-live="polite">
          {queue.isFetching ? "Updating…" : ""}
        </div>
        {queue.isError ? (
          <ErrorState
            description={queue.error.message}
            onRetry={() => void queue.refetch()}
            retrying={queue.isFetching}
          />
        ) : null}
        {queue.isPending ? <ListSkeleton rows={5} /> : null}
        {queue.data ? (
          queue.data.items.length ? (
            <ul className="dei-list" aria-label="Intake cases">
              {queue.data.items.map((item) => {
                const due = dueLabel(item.dueAt);
                const focused = search.caseId === item.id;
                const correction = item.intakeStage === "CORRECTION";
                return (
                  <li
                    key={item.id}
                    className={`dei-row ${focused ? "is-focused" : ""} ${correction ? "is-correction" : ""}`}
                  >
                    <button
                      type="button"
                      className="dei-row-main"
                      aria-pressed={focused}
                      onClick={() => onChange({ caseId: item.id }, true)}
                      aria-label={`Review ${item.candidateName}`}
                    >
                      <span className="dei-avatar" aria-hidden>
                        {initials(item.candidateName)}
                      </span>
                      <span className="min-w-0">
                        <strong>{item.candidateName}</strong>
                        <small>
                          {item.client.name} · {item.caseNumber}
                        </small>
                      </span>
                    </button>
                    <span className="dei-row-tags">
                      <span className={`rmo-pill ${correction ? "is-warn" : "is-info"}`}>
                        {correction ? "Waiting on correction" : "To review"}
                      </span>
                      <span className="dei-tag">
                        <FileText aria-hidden /> {item.documents.total} doc
                        {item.documents.total === 1 ? "" : "s"}
                      </span>
                      <span className="dei-tag">
                        <ListChecks aria-hidden /> {item.checks.total} check
                        {item.checks.total === 1 ? "" : "s"}
                      </span>
                      {item.documents.rejected ? (
                        <span className="rmo-pill is-bad">{item.documents.rejected} rejected</span>
                      ) : null}
                    </span>
                    <span className="dei-row-who">
                      <span>
                        {view === "team"
                          ? (item.dataEntry?.name ?? "—")
                          : `RM ${item.rm?.name ?? "—"}`}
                      </span>
                      <small>since {sinceLabel(item.dataEntryAssignedAt) || "—"}</small>
                    </span>
                    <span className={`rmo-pill is-${due.tone} dei-due`}>{due.text}</span>
                    <span className="dei-row-actions">
                      <Button
                        size="sm"
                        variant={focused ? "default" : "outline"}
                        onClick={() => onChange({ caseId: item.id }, true)}
                      >
                        Review
                      </Button>
                      {view === "team" ? (
                        <Button size="sm" variant="outline" onClick={() => setReassign(item)}>
                          Reassign
                        </Button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="dei-empty">
              <span className="dei-empty-icon">
                <CircleCheck aria-hidden />
              </span>
              <strong>All caught up</strong>
              <span>The RM assigns new cases here once the candidate has submitted.</span>
            </div>
          )
        ) : null}
        <footer className="rmo-pager">
          <span>
            {queue.data ? `${queue.data.total} case${queue.data.total === 1 ? "" : "s"}` : ""}
          </span>
          <div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onChange({ page: page - 1 })}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="rmo-page">
              Page {page} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => onChange({ page: page + 1 })}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </footer>
      </section>
      <IntakeReview
        caseId={search.caseId}
        queueItem={queue.data?.items.find((item) => item.id === search.caseId)}
        onClose={() => onChange({ caseId: undefined }, true)}
      />
      {reassign ? (
        <AssignDataEntryDialog item={reassign} onClose={() => setReassign(undefined)} />
      ) : null}
    </div>
  );
}

/** The case opens in a wide slide-over: summary and Ready on the left, the work on the right. */
function IntakeReview({
  caseId,
  queueItem,
  onClose,
}: {
  caseId?: string;
  queueItem?: QueueCase;
  onClose: () => void;
}) {
  // Keep the last case on screen while the panel slides out.
  const [shownId, setShownId] = useState(caseId);
  useEffect(() => {
    if (caseId) setShownId(caseId);
  }, [caseId]);
  const id = caseId ?? shownId;
  const detail = useQuery({
    queryKey: ["case", id],
    queryFn: () => getCase(id!),
    enabled: Boolean(id),
  });
  return (
    <DialogPrimitive.Root
      open={Boolean(caseId)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dei-sheet-overlay" />
        <DialogPrimitive.Content
          className="dei-sheet"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">
            {detail.data ? `Review ${detail.data.subject.fullName}` : "Case review"}
          </DialogPrimitive.Title>
          <aside className="dei-review-wrap" aria-label="Intake review">
            <Button
              variant="ghost"
              size="icon"
              className="dei-sheet-close"
              aria-label="Close review"
              onClick={onClose}
            >
              <X aria-hidden />
            </Button>
            {detail.isPending ? (
              <div className="dei-panel-pad">
                <ListSkeleton rows={8} />
              </div>
            ) : null}
            {detail.isError ? (
              <div className="dei-panel-pad">
                <ErrorState
                  description={detail.error.message}
                  onRetry={() => void detail.refetch()}
                  retrying={detail.isFetching}
                />
              </div>
            ) : null}
            {detail.data ? (
              <ReviewBody item={detail.data} queueItem={queueItem} onClose={onClose} />
            ) : null}
          </aside>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ReviewBody({
  item,
  queueItem,
  onClose,
}: {
  item: CaseDetail;
  queueItem?: QueueCase;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const readiness = useQuery({
    queryKey: ["case", item.id, "readiness"],
    queryFn: () => getEvidenceReadiness(item.id),
  });
  const requests = useQuery({
    queryKey: ["case", item.id, "clarifications"],
    queryFn: () => listClarifications(item.id),
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
      queryClient.invalidateQueries({ queryKey: ["workflow"] }),
    ]);
  const stage = item.workflow?.intakeStage;
  const open = (requests.data?.items ?? []).filter((request) =>
    ["OPEN", "RESPONDED"].includes(request.status),
  );
  const rejected = item.documents.filter((document) => document.status === "REJECTED");
  const accepted = item.documents.filter((document) => document.status === "VERIFIED");
  const docIssues = (readiness.data?.issues ?? []).filter((issue) =>
    (readiness.data?.requiredTypes ?? []).some((type) => issue.startsWith(`${type}:`)),
  );
  const consentAccepted = item.consents.some((consent) => consent.status === "ACCEPTED");
  const forms = useQuery({
    queryKey: ["workflow", "initiation-forms"],
    queryFn: getInitiationForms,
    staleTime: Infinity,
  });
  const initiable = item.checks.filter((check) => forms.data?.forms[check.type.toUpperCase()]);
  const notInitiated = initiable.filter((check) => !check.initiatedAt);
  const blockers = [
    ...(!consentAccepted ? ["Candidate consent is not accepted yet"] : []),
    ...(open.length
      ? [`${open.length} correction request${open.length > 1 ? "s" : ""} still open`]
      : []),
    ...(rejected.length
      ? [`${rejected.length} rejected document${rejected.length > 1 ? "s" : ""} to be replaced`]
      : []),
    ...(notInitiated.length
      ? [
          `Initiate ${notInitiated.length === 1 ? "this check" : "these checks"}: ${notInitiated
            .map((check) => readableCheck(check.type))
            .join(", ")}`,
        ]
      : []),
    ...docIssues.map((issue) =>
      issue.replace(/^(\w+):/, (_m, type: string) => `${readableCheck(type)}:`),
    ),
  ];
  const steps = [
    { label: "Consent", done: consentAccepted, detail: consentAccepted ? "Accepted" : "Pending" },
    {
      label: "Documents",
      done: !docIssues.length && !rejected.length && item.documents.length > 0,
      detail: `${accepted.length}/${item.documents.length} accepted`,
    },
    {
      label: "Checks",
      done: !notInitiated.length,
      detail: `${initiable.length - notInitiated.length}/${initiable.length} initiated`,
    },
    {
      label: "Corrections",
      done: !open.length,
      detail: open.length ? `${open.length} open` : "None open",
    },
  ];
  const progress = Math.round((steps.filter((step) => step.done).length / steps.length) * 100);
  const due = dueLabel(item.dueAt ?? queueItem?.dueAt ?? null);
  const ready = useMutation({
    mutationFn: () => markCaseReady(item.id, { version: item.version }),
    onSuccess: async () => {
      toast.success(`${item.caseNumber} is Ready — sent back to the RM`);
      await refresh();
      onClose();
    },
    onError: (error: Error) => toast.error("Not marked Ready", { description: error.message }),
  });
  return (
    <div className="dei-review">
      <div className="dei-review-side">
        <header className="dei-panel-head">
          <span className="dei-avatar is-lg" aria-hidden>
            {initials(item.subject.fullName)}
          </span>
          <div className="min-w-0">
            <h2>{item.subject.fullName}</h2>
            <p>
              <span className="dei-id">{item.caseNumber}</span>
              <span>{item.client.displayName}</span>
              {item.assignedOpsUser ? <span>RM {item.assignedOpsUser.displayName}</span> : null}
            </p>
          </div>
        </header>
        <div className="dei-panel-tags">
          <span className={`rmo-pill ${stage === "CORRECTION" ? "is-warn" : "is-info"}`}>
            {stage === "CORRECTION" ? "Waiting on correction" : "To review"}
          </span>
          <span className={`rmo-pill is-${due.tone}`}>{due.text}</span>
          {item.checks.map((check) => (
            <span key={check.publicId} className="dei-tag">
              {readableCheck(check.type)}
            </span>
          ))}
        </div>
        <section className="dei-progress" aria-label="Readiness">
          <div className="dei-progress-head">
            <strong>Readiness</strong>
            <span>{progress}%</span>
          </div>
          <div
            className="dei-progress-bar"
            role="progressbar"
            aria-label="Readiness"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <ol className="dei-steps">
            {steps.map((step) => (
              <li key={step.label} className={step.done ? "is-done" : ""}>
                {step.done ? <CircleCheck aria-hidden /> : <Circle aria-hidden />}
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <footer className="dei-panel-foot" aria-label="Ready check">
          {blockers.length ? (
            <div className="flow-callout is-bad">
              <CircleAlert aria-hidden />
              <ul>
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flow-callout is-good">
              <ShieldCheck aria-hidden />
              <span>
                Consent accepted, checks initiated, required documents accepted and no open
                corrections.
              </span>
            </div>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={() => ready.mutate()}
            disabled={Boolean(blockers.length) || stage !== "DATA_ENTRY"}
            loading={ready.isPending}
          >
            <Send aria-hidden />
            Mark Ready and return to RM
          </Button>
          {queueItem?.dataEntryAssignedAt ? (
            <p className="dei-foot-note">Assigned {istDateTime(queueItem.dataEntryAssignedAt)}</p>
          ) : null}
        </footer>
      </div>
      <div className="dei-panel-body">
        <div className="dei-review-title">
          <small>Case review</small>
          <strong>Documents, check details and corrections</strong>
        </div>
        {stage === "CORRECTION" ? (
          <div className="flow-callout is-warn">
            <MessageSquareText aria-hidden />
            <span>
              Waiting on a correction. When every request is resolved the case returns to you for a
              recheck.
            </span>
          </div>
        ) : null}
        <section className="dei-section" aria-label="Documents">
          <h3>
            <FileCheck2 aria-hidden /> Documents
            <span className="dei-count">{item.documents.length}</span>
          </h3>
          {item.documents.length ? (
            item.documents.map((document) => (
              <DocumentRow
                key={document.publicId}
                caseItem={item}
                document={document}
                onDone={refresh}
              />
            ))
          ) : (
            <p className="ops-subtle">No documents uploaded yet.</p>
          )}
        </section>
        <div className="dei-section is-plain">
          <CheckInitiation
            item={item}
            editable={["DATA_ENTRY", "CORRECTION"].includes(stage ?? "")}
            onSaved={refresh}
          />
        </div>
        <section className="dei-section" aria-label="Correction requests">
          <h3>
            <MessageSquareText aria-hidden /> Correction requests (L1)
            <span className="dei-count">{requests.data?.items.length ?? 0}</span>
          </h3>
          {requests.isPending ? <p className="ops-subtle">Loading…</p> : null}
          {(requests.data?.items ?? []).map((request) => (
            <RequestRow key={request.id} caseId={item.id} request={request} onDone={refresh} />
          ))}
          {requests.data && !requests.data.items.length ? (
            <p className="ops-subtle">No corrections requested.</p>
          ) : null}
          <RaiseCorrection
            caseId={item.id}
            disabled={!["DATA_ENTRY", "CORRECTION"].includes(stage ?? "")}
            onDone={refresh}
          />
        </section>
      </div>
    </div>
  );
}

function DocumentRow({
  caseItem,
  document,
  onDone,
}: {
  caseItem: CaseDetail;
  document: CaseDetail["documents"][number];
  onDone: () => Promise<unknown>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const latest = document.versions.at(-1);
  const review = useMutation({
    mutationFn: (decision: "VERIFIED" | "REJECTED") =>
      reviewDocument(document.publicId, {
        version: document.version,
        documentVersion: document.currentVersion,
        decision,
        note:
          decision === "VERIFIED"
            ? note.trim() || "Checked at Data Entry: complete and readable"
            : note.trim(),
      }),
    onSuccess: async (_result, decision) => {
      toast.success(
        decision === "VERIFIED" ? "Document accepted" : "Document rejected — replacement requested",
      );
      setRejecting(false);
      setNote("");
      await onDone();
    },
    onError: (error: Error) => toast.error("Review not saved", { description: error.message }),
  });
  const status = document.status;
  const tone = status === "VERIFIED" ? "is-good" : status === "REJECTED" ? "is-bad" : "is-warn";
  const locked = !["DATA_ENTRY", "CORRECTION"].includes(caseItem.workflow?.intakeStage ?? "");
  return (
    <div className={`dei-doc ${tone}`}>
      <span className="dei-doc-icon" aria-hidden>
        <FileText />
      </span>
      <span className="dei-doc-text">
        <strong>{readableCheck(document.type)}</strong>
        <small>
          {latest?.originalName ? `${latest.originalName} · ` : ""}v{document.currentVersion}
          {document.reviewNote ? ` · ${document.reviewNote}` : ""}
        </small>
      </span>
      <span className={`rmo-pill ${tone}`}>
        {status === "VERIFIED" ? "Accepted" : readableCheck(status)}
      </span>
      <span className="dei-doc-actions">
        {latest ? (
          <DocumentFileActions
            documentId={document.publicId}
            filename={latest.originalName}
            label={readableCheck(document.type)}
          />
        ) : null}
        {!locked && latest && status !== "VERIFIED" ? (
          <Button
            size="sm"
            onClick={() => review.mutate("VERIFIED")}
            loading={review.isPending && review.variables === "VERIFIED"}
            disabled={review.isPending}
          >
            Accept
          </Button>
        ) : null}
        {!locked && latest && status !== "REJECTED" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRejecting((value) => !value)}
            disabled={review.isPending}
          >
            Reject
          </Button>
        ) : null}
      </span>
      {rejecting ? (
        <form
          className="dei-doc-reject"
          onSubmit={(event) => {
            event.preventDefault();
            if (note.trim().length >= 5) review.mutate("REJECTED");
          }}
        >
          <input
            className="ops-text-input"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why? e.g. image unreadable, name mismatch"
            aria-label={`Reason to reject ${readableCheck(document.type)}`}
          />
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            disabled={note.trim().length < 5}
            loading={review.isPending && review.variables === "REJECTED"}
          >
            Reject
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function RequestRow({
  caseId,
  request,
  onDone,
}: {
  caseId: string;
  request: {
    id: string;
    status: string;
    subject: string;
    level?: string | null;
    createdAt: string;
    messages: Array<{ senderType: string; body: string }>;
  };
  onDone: () => Promise<unknown>;
}) {
  const resolve = useMutation({
    mutationFn: () => resolveClarification(caseId, request.id),
    onSuccess: async () => {
      toast.success("Correction resolved");
      await onDone();
    },
    onError: (error: Error) => toast.error("Not resolved", { description: error.message }),
  });
  const reply = [...request.messages].reverse().find((message) => message.senderType !== "TEAM");
  const tone =
    request.status === "RESOLVED"
      ? "is-good"
      : request.status === "RESPONDED"
        ? "is-info"
        : "is-warn";
  return (
    <div className="dei-request">
      <span className="min-w-0">
        <strong>{request.subject}</strong>
        <small>
          {request.level ?? "L1"} · raised {istDateTime(request.createdAt)}
        </small>
        {reply ? <q>{reply.body.slice(0, 160)}</q> : null}
      </span>
      <span className="dei-request-side">
        <span className={`rmo-pill ${tone}`}>
          {request.status === "RESPONDED" ? "Response received" : readableCheck(request.status)}
        </span>
        {request.status === "RESPONDED" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve.mutate()}
            loading={resolve.isPending}
          >
            Mark resolved
          </Button>
        ) : null}
      </span>
    </div>
  );
}

function RaiseCorrection({
  caseId,
  disabled,
  onDone,
}: {
  caseId: string;
  disabled: boolean;
  onDone: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createClarification(caseId, { subject: subject.trim(), message: message.trim() }),
    onSuccess: async () => {
      toast.success("Correction requested from the candidate / client");
      setOpen(false);
      setSubject("");
      setMessage("");
      await onDone();
    },
    onError: (error: Error) => toast.error("Correction not raised", { description: error.message }),
  });
  if (!open)
    return (
      <Button
        className="mt-2"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <MessageSquareText aria-hidden />
        Request correction
      </Button>
    );
  return (
    <form
      className="dei-raise"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <label className="ops-field">
        <span>What is missing or wrong?</span>
        <input
          value={subject}
          maxLength={180}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Employment relieving letter missing"
        />
      </label>
      <label className="ops-field">
        <span>Message to the candidate / client</span>
        <textarea
          rows={3}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={subject.trim().length < 3 || message.trim().length < 3}
          loading={create.isPending}
        >
          Send request
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={create.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
