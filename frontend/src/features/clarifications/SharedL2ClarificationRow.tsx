import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClarificationDocumentSection } from "@/features/cases/ClarificationDocumentSection";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import { ApiError } from "@/lib/backend-api/client";
import type {
  ClarificationPortalMode,
  ClarificationUserSummary,
  OpsL2ClarificationItem,
} from "@/lib/backend-api/clarifications-l2-types";
import { completeSharedL2Clarification } from "@/lib/backend-api/clarifications-shared";

function l2StatusBadgeMeta(status: string): {
  label: string;
  tone: "info" | "warning" | "success" | "neutral";
} {
  switch (status) {
    case "CANDIDATE_SUBMITTED":
      return { label: "Candidate submitted", tone: "info" };
    case "DATA_ENTRY_PENDING":
      return { label: "With Data Entry", tone: "neutral" };
    case "RESOLVED":
      return { label: "Resolved", tone: "success" };
    default:
      return { label: humanize(status), tone: "warning" };
  }
}

export function SharedL2ClarificationRow({
  mode,
  item,
  dataEntryUsers,
}: {
  mode: ClarificationPortalMode;
  item: OpsL2ClarificationItem;
  dataEntryUsers: ClarificationUserSummary[];
}) {
  const queryClient = useQueryClient();
  const [assigneeId, setAssigneeId] = useState(
    item.case.dataEntryUser?.id ?? dataEntryUsers[0]?.id ?? "",
  );
  const [note, setNote] = useState("");
  const [showThread, setShowThread] = useState(false);

  const handoff = useMutation({
    mutationFn: () =>
      completeSharedL2Clarification(mode, item.id, {
        dataEntryUserId: assigneeId || undefined,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: async (res) => {
      toast.success("Handed off to Data Entry", {
        description: `${item.case.caseNumber} assigned to ${res.dataEntryUserName}.`,
      });
      setNote("");
      await invalidateWorkflow(queryClient);
    },
    onError: async (error: Error) => {
      toast.error(error.message);
      if (error instanceof ApiError && error.problem.status === 409) {
        await invalidateWorkflow(queryClient);
      }
    },
  });

  const badge = l2StatusBadgeMeta(item.status);
  const canHandoff = item.status === "CANDIDATE_SUBMITTED";
  const selectedUser = assigneeId || item.case.dataEntryUser?.id || dataEntryUsers[0]?.id || "";

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={badge.label} tone={badge.tone} />
            <span className="text-[13.5px] font-semibold text-foreground">{item.subject}</span>
            <span className="num text-[11px] font-medium text-muted-foreground">
              {item.case.caseNumber}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {item.case.subjectName} · {item.case.clientName}
            {item.check ? ` · ${humanize(item.check.type)}` : ""}
            {item.requestedDocumentType
              ? ` · Requested: ${humanize(item.requestedDocumentType)}`
              : ""}
            {item.dueAt ? ` · Due ${formatDateTime(item.dueAt)}` : ""}
          </p>
        </div>
        {(item.rejectionCount ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
            <RotateCcw className="size-3" /> Re-upload #{item.rejectionCount + 1}
          </span>
        ) : null}
      </div>

      {item.lastRejectedReason ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11.5px] text-rose-900">
          <strong>Previous Data Entry rejection:</strong> {item.lastRejectedReason}
        </p>
      ) : null}

      {item.messages.at(-1) ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-[12px]">
          <span className="font-semibold text-muted-foreground">
            {humanize(item.messages.at(-1)!.senderType)}:
          </span>{" "}
          {item.messages.at(-1)!.body}
          {item.messages.length > 1 ? (
            <button
              type="button"
              onClick={() => setShowThread((v) => !v)}
              className="ml-2 text-[11px] font-semibold text-primary hover:underline"
            >
              {showThread ? "Hide history" : `View all ${item.messages.length} messages`}
            </button>
          ) : null}
          {showThread ? (
            <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
              {item.messages.map((m, idx) => (
                <li key={`${m.createdAt}-${idx}`} className="text-[11.5px]">
                  <span className="font-medium text-muted-foreground">
                    {humanize(m.senderType)} ({formatDateTime(m.createdAt)}):
                  </span>{" "}
                  {m.body}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {item.submittedDocument ? (
        <ClarificationDocumentSection
          document={item.submittedDocument}
          submittedVersionNumber={item.submittedDocumentVersion}
        />
      ) : null}

      {canHandoff ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
          <label className="min-w-[190px] flex-1 text-[11px] font-medium text-slate-700">
            Assign Data Entry
            <select
              value={selectedUser}
              onChange={(event) => setAssigneeId(event.target.value)}
              aria-label={`Assign Data Entry for ${item.case.caseNumber}`}
              className="mt-1 block h-9 w-full rounded-lg border border-input bg-white px-2.5 text-xs"
            >
              {dataEntryUsers.length === 0 ? (
                <option value="">No active Data Entry user</option>
              ) : null}
              {dataEntryUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[220px] flex-[1.5] text-[11px] font-medium text-slate-700">
            Handoff note (optional)
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              placeholder="Note for Data Entry (optional)"
              className="mt-1 h-9 bg-white text-xs"
            />
          </label>
          <Button
            size="sm"
            disabled={!selectedUser || handoff.isPending}
            onClick={() => handoff.mutate()}
          >
            {handoff.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 size-3.5" />
            )}
            Done · Send to Data Entry
          </Button>
        </div>
      ) : item.opsReviewedAt ? (
        <p className="inline-flex items-center gap-1.5 text-[11.5px] text-emerald-800">
          <CheckCircle2 className="size-3.5 shrink-0" />
          Handed off
          {item.opsReviewedBy ? ` by ${item.opsReviewedBy.displayName}` : ""} to{" "}
          {item.case.dataEntryUser?.displayName ?? "Data Entry"} on{" "}
          {formatDateTime(item.opsReviewedAt)}
          {item.opsReviewNote ? ` · “${item.opsReviewNote}”` : ""}
        </p>
      ) : null}
    </li>
  );
}
