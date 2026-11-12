import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileWarning, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ClarificationDocumentSection } from "@/features/cases/ClarificationDocumentSection";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import {
  completeL2Reentry,
  getReentryClarificationDetail,
  rejectL2Document,
  type ReentryClarificationItem,
} from "@/lib/backend-api/clarifications";
import { fieldShown } from "@/lib/backend-api/workflow";
import { DataEntryL2EntriesForm } from "./DataEntryL2EntriesForm";
import { DataEntryL2RejectBox } from "./DataEntryL2RejectBox";

export function DataEntryL2ReentryDrawer({
  clarificationId,
  hideHeaderClose,
  onClose,
  onCompleted,
}: {
  clarificationId: string;
  hideHeaderClose?: boolean;
  onClose: () => void;
  onCompleted: () => Promise<void>;
}) {
  const detail = useQuery({
    queryKey: ["workflow", "l2-reentry", clarificationId],
    queryFn: () => getReentryClarificationDetail(clarificationId),
  });

  if (detail.isPending) {
    return (
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <WorkspaceLoading label="Loading L2 clarification details" />
      </aside>
    );
  }
  if (detail.isError) {
    return (
      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <WorkspaceError message={detail.error.message} onRetry={() => void detail.refetch()} />
      </aside>
    );
  }
  return (
    <ReentryDrawerBody
      key={`${detail.data.id}-${detail.data.submittedDocumentVersion ?? 0}`}
      item={detail.data}
      hideHeaderClose={hideHeaderClose}
      onClose={onClose}
      onCompleted={onCompleted}
    />
  );
}

function ReentryDrawerBody({
  item,
  hideHeaderClose,
  onClose,
  onCompleted,
}: {
  item: ReentryClarificationItem;
  hideHeaderClose?: boolean;
  onClose: () => void;
  onCompleted: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const form = item.check?.form ?? null;
  const [entries, setEntries] = useState<Array<Record<string, string>>>(() =>
    !form ? [] : item.check?.entries.length ? item.check.entries : [{}],
  );
  const [note, setNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const submittedDoc = item.submittedDocument;
  const submittedVer =
    submittedDoc?.versions?.find((v) => v.version === item.submittedDocumentVersion) ??
    submittedDoc?.versions?.find((v) => v.isSubmitted) ??
    submittedDoc?.versions?.[0];

  const refreshQueues = (checkId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workflow", "l2-reentry"] }),
      queryClient.invalidateQueries({ queryKey: ["workflow", "data-entry"] }),
      ...(checkId
        ? [queryClient.invalidateQueries({ queryKey: ["checks", checkId, "verified-details"] })]
        : []),
      invalidateWorkflow(queryClient),
    ]);

  const complete = useMutation({
    mutationFn: () =>
      completeL2Reentry(item.id, {
        ...(item.submittedDocumentVersion != null
          ? { documentVersion: item.submittedDocumentVersion }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(form ? { entries } : {}),
      }),
    onSuccess: async (res) => {
      toast.success("Details re-entered and check returned to Verifier", {
        description:
          res.reopenedDependentCount > 0
            ? `Promoted v${res.promotedDocumentVersion}. Reopened ${res.reopenedDependentCount} shared check(s).`
            : `Promoted v${res.promotedDocumentVersion}. Verifier can now run final verification.`,
      });
      await refreshQueues(item.check?.id);
      await onCompleted();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reject = useMutation({
    mutationFn: () =>
      rejectL2Document(item.id, {
        reason: rejectReason.trim(),
        ...(item.submittedDocumentVersion != null
          ? { documentVersion: item.submittedDocumentVersion }
          : {}),
      }),
    onSuccess: async (res) => {
      toast.success("Document rejected · returned to candidate", {
        description: `Rejected v${res.rejectedVersion}. Prior baseline preserved; fresh candidate upload link queued.`,
      });
      await refreshQueues();
      await onCompleted();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const missingRequired = form
    ? entries.some((entry) =>
        form.fields.some(
          (field) => fieldShown(field, entry) && field.required && !entry[field.key]?.trim(),
        ),
      )
    : false;
  const busy = complete.isPending || reject.isPending;

  return (
    <aside
      aria-label={`L2 re-entry ${item.case.subjectName}`}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
            L2 Clarification Re-entry · {item.case.caseNumber}
          </p>
          <h2 className="mt-0.5 truncate text-base font-bold text-slate-900">
            {item.case.subjectName} — {item.check ? humanize(item.check.type) : "Case"}
          </h2>
          <p className="text-xs text-slate-500">
            {item.case.clientName} · Subject: {item.subject}
            {item.opsReviewedAt ? ` · Ops handoff ${formatDateTime(item.opsReviewedAt)}` : ""}
          </p>
        </div>
        {!hideHeaderClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close detail"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </header>

      {item.opsReviewNote ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3.5 py-2.5 text-xs text-blue-950">
          <strong>Operations handoff note:</strong> {item.opsReviewNote}
        </div>
      ) : null}

      {item.dependentChecks.count > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">
              Shared document impacts {item.dependentChecks.count} other check(s)
            </p>
            <ul className="mt-1 list-disc pl-4">
              {item.dependentChecks.items.map((dep) => (
                <li key={dep.checkId}>
                  {humanize(dep.checkType)} ({humanize(dep.status)})
                  {dep.willReopen ? " — will reopen for re-verification after acceptance" : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {submittedDoc ? (
        <ClarificationDocumentSection
          document={submittedDoc}
          submittedVersionNumber={item.submittedDocumentVersion}
          headingPrefix="Candidate upload to inspect"
          showHistoryWhenSingle={false}
        />
      ) : null}

      <div className="space-y-1.5 rounded-xl border border-slate-200 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Clarification messages
        </p>
        {item.messages.map((msg, idx) => (
          <p key={`${msg.createdAt}-${idx}`} className="text-xs text-slate-700">
            <strong className="text-slate-900">{humanize(msg.senderType)}:</strong> {msg.body}
          </p>
        ))}
      </div>

      {form ? (
        <DataEntryL2EntriesForm
          checkType={item.check!.type}
          form={form}
          entries={entries}
          busy={busy}
          onChange={setEntries}
        />
      ) : null}

      <label className="block text-xs font-medium text-slate-700">
        Data Entry completion note (optional)
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          disabled={busy}
          placeholder="Summary of corrected details entered…"
          className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-3 text-xs outline-none"
        />
      </label>

      {rejectOpen ? (
        <DataEntryL2RejectBox
          reason={rejectReason}
          onChangeReason={setRejectReason}
          busy={busy}
          submitting={reject.isPending}
          onCancel={() => setRejectOpen(false)}
          onConfirm={() => reject.mutate()}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy || rejectOpen}
          onClick={() => setRejectOpen(true)}
          className="border-rose-200 text-rose-700 hover:bg-rose-50"
        >
          <FileWarning className="mr-1.5 size-4" /> Reject document
        </Button>
        <Button
          type="button"
          disabled={busy || missingRequired || !submittedVer}
          onClick={() => complete.mutate()}
        >
          {complete.isPending ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 size-4" />
          )}
          Accept v{item.submittedDocumentVersion ?? "?"} & return check to Verifier
        </Button>
      </div>
    </aside>
  );
}
