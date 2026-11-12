import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, MessageSquareText } from "lucide-react";
import type { CaseDetail } from "@/lib/api/cases";
import { listClarifications } from "@/lib/backend-api/clarifications";
import { getEvidenceReadiness } from "@/lib/backend-api/documents";
import { getInitiationForms, type QueueCase } from "@/lib/backend-api/workflow";
import { CheckInitiation } from "./CheckInitiation";
import {
  DataEntryDocumentRow,
  DataEntryRaiseCorrection,
  DataEntryRequestRow,
} from "./DataEntryReviewRows";
import { DataEntryReviewSidebar } from "./DataEntryReviewSidebar";
import { readableCheck } from "./flow-model";

export function DataEntryReviewBody({
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
  const rejected = item.documents.filter((document) =>
    ["REJECTED", "REUPLOAD_REQUIRED"].includes(document.status),
  );
  const accepted = item.documents.filter((document) => document.status === "VERIFIED");
  const toReview = item.documents.filter(
    (document) =>
      document.currentVersion > 0 &&
      !["VERIFIED", "REJECTED", "REUPLOAD_REQUIRED"].includes(document.status),
  );
  const checkStates = readiness.data?.checks;
  const openChecks = (checkStates ?? []).filter((row) => !row.sentToTeam);
  const waitingChecks = openChecks.filter((row) => row.state === "WAITING_CANDIDATE");
  const sentChecks = (checkStates ?? []).filter((row) => row.sentToTeam);
  const consentAccepted = item.consents.some((consent) => consent.status === "ACCEPTED");
  const forms = useQuery({
    queryKey: ["workflow", "initiation-forms"],
    queryFn: getInitiationForms,
    staleTime: Infinity,
  });
  const initiable = item.checks.filter((check) => forms.data?.forms[check.type.toUpperCase()]);
  const notInitiated = initiable.filter((check) => {
    const row = checkStates?.find((state) => state.id === check.publicId);
    return !check.initiatedAt && row?.state !== "WAITING_CANDIDATE" && !row?.sentToTeam;
  });
  const blockers = [
    ...(!consentAccepted ? ["Candidate consent is not accepted yet"] : []),
    ...(open.length
      ? [`${open.length} correction request${open.length > 1 ? "s" : ""} still open`]
      : []),
    ...(toReview.length
      ? [
          `Accept or reject: ${[...new Set(toReview.map((document) => readableCheck(document.type)))].join(", ")}`,
        ]
      : []),
    ...(notInitiated.length
      ? [
          `Initiate ${notInitiated.length === 1 ? "this check" : "these checks"}: ${notInitiated
            .map((check) => readableCheck(check.type))
            .join(", ")}`,
        ]
      : []),
    ...(checkStates && openChecks.length === waitingChecks.length && waitingChecks.length
      ? ["Every remaining check waits for the candidate's documents"]
      : []),
  ];
  const steps = [
    { label: "Consent", done: consentAccepted, detail: consentAccepted ? "Accepted" : "Pending" },
    {
      label: "Documents",
      done: !toReview.length && !rejected.length && item.documents.length > 0,
      detail: `${accepted.length}/${item.documents.length} accepted${rejected.length ? ` · ${rejected.length} rejected` : ""}`,
    },
    {
      label: "Checks",
      done: !notInitiated.length,
      detail: `${initiable.filter((check) => check.initiatedAt).length}/${initiable.length} initiated`,
    },
    {
      label: "Corrections",
      done: !open.length,
      detail: open.length ? `${open.length} open` : "None open",
    },
  ];
  const progress = Math.round((steps.filter((step) => step.done).length / steps.length) * 100);

  return (
    <div className="dei-review">
      <DataEntryReviewSidebar
        item={item}
        queueItem={queueItem}
        steps={steps}
        progress={progress}
        blockers={blockers}
        waitingChecks={waitingChecks}
        sentChecks={sentChecks}
        acceptedCount={accepted.length}
        rejectedCount={rejected.length}
        checkStatesLoaded={Boolean(checkStates)}
        openChecksCount={openChecks.length}
        onRefresh={refresh}
        onClose={onClose}
      />
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
              <DataEntryDocumentRow
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
            editable={["DATA_ENTRY", "CORRECTION"].includes(stage ?? "") && readiness.isSuccess}
            checkStates={checkStates}
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
            <DataEntryRequestRow
              key={request.id}
              caseId={item.id}
              request={request}
              onDone={refresh}
            />
          ))}
          {requests.data && !requests.data.items.length ? (
            <p className="ops-subtle">No corrections requested.</p>
          ) : null}
          <DataEntryRaiseCorrection
            caseId={item.id}
            disabled={!["DATA_ENTRY", "CORRECTION"].includes(stage ?? "")}
            onDone={refresh}
          />
        </section>
      </div>
    </div>
  );
}
