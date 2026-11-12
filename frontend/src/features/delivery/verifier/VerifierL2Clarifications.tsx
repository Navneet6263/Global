import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { ClarificationDocumentSection } from "@/features/cases/ClarificationDocumentSection";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import {
  listClarifications,
  resolveClarification,
  type Clarification,
} from "@/lib/api/clarifications";
import type { VerifierTaskContext } from "@/lib/api/tasks";
import { VerifierRaiseInsufficiencyForm } from "./VerifierRaiseInsufficiencyForm";

function parseEntries(json?: string | null): Array<Record<string, string>> {
  try {
    const parsed = JSON.parse(json ?? "") as { entries?: Array<Record<string, string>> };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function l2StatusBadge(item: Clarification) {
  if (item.level === "L2" && item.status === "RESOLVED" && item.reentryCompletedAt) {
    return {
      label: "All details re-entered by Data Entry",
      tone: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    };
  }
  switch (item.status) {
    case "CANDIDATE_SUBMITTED":
      return {
        label: "Candidate uploaded · awaiting Operations",
        tone: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
      };
    case "DATA_ENTRY_PENDING":
      return {
        label: "With Data Entry for re-entry",
        tone: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
      };
    case "OPEN":
      return {
        label: (item.rejectionCount ?? 0) > 0 ? "Re-upload requested" : "Waiting on candidate",
        tone: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
      };
    default:
      return { label: humanize(item.status), tone: "bg-slate-100 text-slate-700" };
  }
}

export function VerifierL2Clarifications({ context }: { context: VerifierTaskContext }) {
  const caseId = context.check.case.publicId;
  const checkId = context.check.publicId;
  const queryClient = useQueryClient();

  const clarifications = useQuery({
    queryKey: ["clarifications", caseId],
    queryFn: () => listClarifications(caseId),
  });

  const activeCheckL2 = clarifications.data?.items.find(
    (item) =>
      item.level === "L2" &&
      item.checkId === checkId &&
      ["OPEN", "CANDIDATE_SUBMITTED", "DATA_ENTRY_PENDING"].includes(item.status),
  );

  const resolve = useMutation({
    mutationFn: (clarificationId: string) => resolveClarification(caseId, clarificationId),
    onSuccess: (result) => {
      toast.success("Reply reviewed", {
        description:
          result.caseStatus === "IN_PROGRESS"
            ? "The case has resumed. Complete your verification on the Verification tab."
            : "Closed. Another insufficiency on this case is still open.",
      });
      void queryClient.invalidateQueries({ queryKey: ["clarifications", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const initiatedEntries = parseEntries(context.check.initiationJson);

  return (
    <div className="space-y-4">
      <VerifierRaiseInsufficiencyForm
        caseId={caseId}
        checkId={checkId}
        taskId={context.publicId}
        checkType={context.check.type}
        activeClarification={activeCheckL2}
        activeStatusLabel={activeCheckL2 ? l2StatusBadge(activeCheckL2).label : undefined}
      />

      {clarifications.data?.items.map((item) => {
        const badge = l2StatusBadge(item);
        const isCurrentCheck = item.checkId === checkId;
        return (
          <article key={item.id} className="rounded-xl border border-border/70 bg-slate-50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[12px] font-semibold">{item.subject}</p>
                  {item.level ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                      {item.level}
                    </span>
                  ) : null}
                  {isCurrentCheck ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      This check
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Raised {formatDateTime(item.createdAt)}
                  {item.requestedDocumentType
                    ? ` · Requested: ${humanize(item.requestedDocumentType)}`
                    : ""}
                  {item.submittedDocumentVersion
                    ? ` · Submitted v${item.submittedDocumentVersion}`
                    : ""}
                  {` · ${item.messages.length} messages`}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.tone}`}>
                {badge.label}
              </span>
            </div>

            {item.level === "L2" && item.reentryCompletedAt ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-950">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
                  <span>All details re-entered by Data Entry</span>
                </div>
                <p className="mt-1 text-[11.5px] text-emerald-900">
                  Completed {formatDateTime(item.reentryCompletedAt)}
                  {item.reentryCompletedBy ? ` by ${item.reentryCompletedBy.displayName}` : ""}
                  {item.submittedDocumentVersion
                    ? ` · Promoted v${item.submittedDocumentVersion}`
                    : ""}
                  . Perform your independent final verification on the Verification tab.
                </p>
                {item.dataEntryReviewNote ? (
                  <p className="mt-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-[11.5px]">
                    Data Entry note: {item.dataEntryReviewNote}
                  </p>
                ) : null}
                {isCurrentCheck && initiatedEntries.length > 0 ? (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-white/90 p-2.5 text-[11px]">
                    <p className="font-semibold text-slate-800">Updated check details</p>
                    <div className="mt-1.5 space-y-1.5">
                      {initiatedEntries.map((entry, idx) => (
                        <div key={idx} className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                          {Object.entries(entry)
                            .filter(([, val]) => String(val ?? "").trim() !== "")
                            .map(([k, val]) => (
                              <p key={k} className="truncate text-slate-600">
                                <span className="font-medium text-slate-800">{humanize(k)}:</span>{" "}
                                {val}
                              </p>
                            ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {(item.rejectionCount ?? 0) > 0 && item.lastRejectedReason ? (
              <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-900">
                <RotateCcw className="mt-0.5 size-3.5 shrink-0" />
                <div>
                  <span className="font-semibold">
                    Data Entry rejected previous upload ({item.rejectionCount}x):
                  </span>{" "}
                  {item.lastRejectedReason}
                </div>
              </div>
            ) : null}

            {item.submittedDocument ? (
              <div className="mt-2.5">
                <ClarificationDocumentSection
                  document={item.submittedDocument}
                  submittedVersionNumber={item.submittedDocumentVersion}
                />
              </div>
            ) : null}

            <div className="mt-2.5 space-y-1.5">
              {item.messages.map((entry, idx) => (
                <div
                  key={`${entry.createdAt}-${idx}`}
                  className="rounded-xl bg-white p-2.5 text-[12px]"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {humanize(entry.senderType)} · {formatDateTime(entry.createdAt)}
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{entry.body}</p>
                </div>
              ))}
            </div>

            {item.level !== "L2" && item.status === "RESPONDED" ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="text-[12px] text-emerald-900">
                  The candidate has replied. Review the reply and resume verification.
                </span>
                <button
                  type="button"
                  onClick={() => resolve.mutate(item.id)}
                  disabled={resolve.isPending}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {resolve.isPending && resolve.variables === item.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  Reviewed – resume verification
                </button>
              </div>
            ) : null}
          </article>
        );
      })}

      {!clarifications.isLoading && !clarifications.data?.items.length ? (
        <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border bg-slate-50 p-6 text-center">
          <div>
            <AlertTriangle className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-[12px] font-semibold">No clarification history yet</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              L2 document insufficiency requests and re-entry history will appear here.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
