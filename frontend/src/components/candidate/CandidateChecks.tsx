import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquareText, Send } from "lucide-react";
import { useState } from "react";

import { formatDate, humanize } from "./candidate-utils";
import { CandidateStatus } from "./candidate-ui";
import { respondToCandidateClarification, type CandidateCase } from "@/lib/api/candidate-portal";

export function CandidateChecks({
  accessId,
  token,
  data,
}: {
  accessId: string;
  token: string;
  data: CandidateCase;
}) {
  return (
    <section className="surface rounded-3xl p-5">
      <h2 className="text-sm font-semibold">Verification checks</h2>
      <p className="text-xs text-muted-foreground">
        Progress is visible here while protected verification sources remain private.
      </p>
      <div className="mt-4 space-y-2">
        {data.checks.map((check) => (
          <div
            key={check.type}
            className="flex items-center justify-between rounded-2xl bg-secondary/45 p-3"
          >
            <p className="text-sm font-medium">{humanize(check.type)}</p>
            <CandidateStatus value={check.status} />
          </div>
        ))}
      </div>
      {data.clarifications.length ? (
        <div className="mt-5 border-t border-border/70 pt-5">
          <h3 className="text-xs font-semibold">Information requests</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Reply here securely; the operations team is notified immediately.
          </p>
          <div className="mt-3 space-y-3">
            {data.clarifications.map((item) => (
              <ClarificationCard key={item.id} accessId={accessId} token={token} item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ClarificationCard({
  accessId,
  token,
  item,
}: {
  accessId: string;
  token: string;
  item: CandidateCase["clarifications"][number];
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const response = useMutation({
    mutationFn: () => respondToCandidateClarification(accessId, token, item.id, message.trim()),
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({
        queryKey: ["candidate-portal", accessId, token],
      });
    },
  });
  return (
    <article className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5">
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold">{item.subject}</p>
            <CandidateStatus value={item.status} />
          </div>
          {item.dueAt ? (
            <p className="mt-1 text-[10px] text-amber-800">Reply by {formatDate(item.dueAt)}</p>
          ) : null}
          <div className="mt-3 space-y-2">
            {item.messages.map((entry, index) => (
              <div key={`${entry.createdAt}-${index}`} className="rounded-xl bg-white/80 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  {entry.sender === "CANDIDATE" ? "Your response" : "Verification team"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-4">{entry.body}</p>
              </div>
            ))}
          </div>
          {item.status === "OPEN" ? (
            <div className="mt-3">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={5000}
                rows={3}
                placeholder="Type a clear response…"
                className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-orange-400"
              />
              {response.isError ? (
                <p className="mt-1 text-[10px] text-destructive">{response.error.message}</p>
              ) : null}
              <button
                type="button"
                onClick={() => response.mutate()}
                disabled={message.trim().length < 2 || response.isPending}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {response.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send response
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
