import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { listClarifications, respondToClarificationAsClient } from "@/lib/api/clarifications";
import { Button, Chip, Textarea } from "@/kit";
import { formatDate, humanize, statusKind } from "./client-portal-utils";

export function ClientClarificationCard({
  caseId,
  item,
  canRespond,
}: {
  caseId: string;
  item: Awaited<ReturnType<typeof listClarifications>>["items"][number];
  canRespond: boolean;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const respond = useMutation({
    mutationFn: () => respondToClarificationAsClient(caseId, item.id, message.trim()),
    onSuccess: () => {
      toast.success("Response submitted");
      setMessage("");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clarifications", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["cases", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "client", "actions"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <article className="rounded-lg border border-warn/25 bg-warn-soft/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface text-warn">
            <MessageSquareText className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{item.subject}</p>
            <p className="mt-0.5 text-xs text-dim">
              {item.messages.length} messages ·{" "}
              {item.dueAt ? `Due ${formatDate(item.dueAt)}` : "No due date"}
            </p>
          </div>
        </div>
        <Chip tone={statusKind(item.status)}>{humanize(item.status)}</Chip>
      </div>
      {item.messages.slice(-2).map((entry) => (
        <div
          key={`${entry.createdAt}-${entry.body}`}
          className="mt-2 rounded-md border border-line bg-surface p-3 text-sm leading-5 text-dim"
        >
          <span className="font-semibold text-ink">{humanize(entry.senderType)}:</span> {entry.body}
        </div>
      ))}
      {canRespond && item.status === "OPEN" ? (
        <div className="mt-3 flex gap-2">
          <Textarea
            value={message}
            aria-label="Your response"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your response or confirm the document re-upload"
            className="flex-1"
          />
          <Button
            variant="primary"
            onClick={() => respond.mutate()}
            disabled={message.trim().length < 2}
            loading={respond.isPending}
            aria-label="Submit response"
            className="h-auto w-11 px-0"
          >
            <Send aria-hidden />
          </Button>
        </div>
      ) : null}
    </article>
  );
}
