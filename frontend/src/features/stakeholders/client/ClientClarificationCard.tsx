import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { listClarifications, respondToClarificationAsClient } from "@/lib/api/clarifications";
import { formatDate, humanize, statusTone } from "./client-portal-utils";

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
    <article className="rounded-2xl border border-warning/20 bg-warning-soft/50 p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-card text-warning-foreground">
            <MessageSquareText className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{item.subject}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {item.messages.length} messages ·{" "}
              {item.dueAt ? `Due ${formatDate(item.dueAt)}` : "No due date"}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[9px] font-bold ring-1 ring-inset ${statusTone(item.status)}`}
        >
          {humanize(item.status)}
        </span>
      </div>
      {item.messages.slice(-2).map((entry) => (
        <div
          key={`${entry.createdAt}-${entry.body}`}
          className="mt-2 rounded-xl border border-white/80 bg-card p-3 text-[11px] leading-5 text-muted-foreground shadow-[var(--shadow-card)]"
        >
          <span className="font-semibold text-foreground">{humanize(entry.senderType)}:</span>{" "}
          {entry.body}
        </div>
      ))}
      {canRespond && item.status === "OPEN" ? (
        <div className="mt-3 flex gap-2">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your response or confirm the document re-upload"
            className="min-h-20 flex-1 rounded-xl border border-warning/30 bg-card p-3 text-xs text-foreground outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/8"
          />
          <button
            type="button"
            onClick={() => respond.mutate()}
            disabled={message.trim().length < 2 || respond.isPending}
            aria-busy={respond.isPending}
            aria-label="Submit response"
            className="grid w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-card)] disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </article>
  );
}
