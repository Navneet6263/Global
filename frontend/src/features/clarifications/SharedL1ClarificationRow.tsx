import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { formatRelativeToNow } from "@/lib/formatting";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import { ApiError } from "@/lib/backend-api/client";
import { listClarifications } from "@/lib/backend-api/clarifications";
import type {
  ClarificationPortalMode,
  SharedL1ClarificationItem,
} from "@/lib/backend-api/clarifications-l2-types";
import { resolveSharedClarification } from "@/lib/backend-api/clarifications-shared";

function stateBadge(status: string): {
  label: string;
  tone: "warning" | "info" | "success" | "neutral";
} {
  if (status === "RESPONDED") {
    return { label: "Response received", tone: "info" };
  }
  if (status === "RESOLVED") {
    return { label: "Resolved", tone: "success" };
  }
  return { label: "Awaiting response", tone: "warning" };
}

export function SharedL1ClarificationRow({
  mode,
  item,
}: {
  mode: ClarificationPortalMode;
  item: SharedL1ClarificationItem;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const fullThread = useQuery({
    queryKey: ["clarifications", "thread", item.caseId],
    queryFn: () => listClarifications(item.caseId),
    enabled: open,
    staleTime: 30_000,
  });

  const resolve = useMutation({
    mutationFn: () => resolveSharedClarification(mode, item.caseId, item.id, note),
    onSuccess: async () => {
      toast.success("Clarification resolved", {
        description: `${item.caseNumber}: ${item.subject}`,
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

  const badge = stateBadge(item.status);
  const threadMessages =
    fullThread.data?.items
      .find((entry) => entry.id === item.id)
      ?.messages.map((msg, idx) => ({
        id: `${item.id}-${idx}-${msg.createdAt}`,
        author: msg.senderType,
        at: msg.createdAt,
        body: msg.body,
      })) ?? [];

  return (
    <li className="space-y-2.5 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={badge.label} tone={badge.tone} />
        <span className="text-[13px] font-medium text-foreground">{item.subject}</span>
        <span className="num text-[11px] text-muted-foreground">{item.caseNumber}</span>
        {item.overdue ? <StatusBadge label="Overdue" tone="critical" /> : null}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {item.candidateName} · {item.clientName}
        {item.checkType ? ` · ${humanize(item.checkType)}` : ""}
        {item.raisedBy ? ` · raised by ${item.raisedBy.displayName}` : ""}
        {item.dueAt ? ` · due ${formatDateTime(item.dueAt)}` : ""}
      </p>

      {item.latestMessage ? (
        <p className="text-[12px] text-foreground/85">
          <span className="text-muted-foreground">{humanize(item.latestMessage.senderType)}:</span>{" "}
          {item.latestMessage.body}
        </p>
      ) : null}

      {open ? (
        <ul className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          {fullThread.isPending ? (
            <li className="text-[11px] text-muted-foreground">Loading complete thread…</li>
          ) : null}
          {fullThread.isError ? (
            <li className="flex items-center justify-between gap-3 text-[11px] text-critical-foreground">
              Complete thread could not be loaded.
              <Button size="sm" variant="ghost" onClick={() => void fullThread.refetch()}>
                Retry
              </Button>
            </li>
          ) : null}
          {threadMessages.map((message) => (
            <li key={message.id} className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground">
                {humanize(message.author)} · {formatRelativeToNow(message.at)}
              </p>
              <p className="text-[12px] text-foreground/90">{message.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide thread" : "View complete thread"}
        </Button>
        {item.status === "RESPONDED" ? (
          <>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Resolution note (optional)"
              aria-label={`Resolution note for ${item.caseNumber}`}
              className="h-8 w-56 text-xs"
            />
            <Button
              size="sm"
              disabled={resolve.isPending}
              loading={resolve.isPending}
              onClick={() => resolve.mutate()}
            >
              Resolve response
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}
