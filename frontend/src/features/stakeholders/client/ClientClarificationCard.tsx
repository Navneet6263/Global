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
    onSuccess: async () => {
      toast.success("Response submitted");
      setMessage("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clarifications", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["cases", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "client", "actions"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <article className="rounded-2xl bg-amber-50/45 p-4 ring-1 ring-amber-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
            <MessageSquareText className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold">{item.subject}</p>
            <p className="mt-1 text-[10px] text-slate-500">
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
          className="mt-2 rounded-xl bg-white p-3 text-[11px] leading-5 text-slate-600"
        >
          <span className="font-semibold text-slate-800">{humanize(entry.senderType)}:</span>{" "}
          {entry.body}
        </div>
      ))}
      {canRespond && item.status === "OPEN" ? (
        <div className="mt-3 flex gap-2">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your response or confirm the document re-upload"
            className="min-h-20 flex-1 rounded-xl border border-amber-200 bg-white p-3 text-xs outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
          />
          <button
            type="button"
            onClick={() => respond.mutate()}
            disabled={message.trim().length < 2 || respond.isPending}
            aria-label="Submit response"
            className="grid w-11 place-items-center rounded-xl bg-slate-950 text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </article>
  );
}
