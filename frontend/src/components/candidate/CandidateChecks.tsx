import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Loader2, MessageSquareText, Send } from "lucide-react";
import { useState } from "react";

import type { CandidateCase } from "@/lib/api/candidate-portal";
import { respondToCandidateClarification } from "@/lib/api/candidate-portal";
import { CandidateStatus } from "./candidate-ui";
import { formatDate, humanize } from "./candidate-utils";

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
    <section className="surface rounded-[1.75rem] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint-soft text-mint-deep">
          <ClipboardCheck className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Verification checks</h2>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
            You can track progress while protected source details remain private.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {data.checks.length ? (
          data.checks.map((check) => (
            <div
              key={check.type}
              className="flex items-center justify-between gap-3 rounded-[1rem] bg-secondary/45 px-3 py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <CheckCircle2
                  className={`size-4 shrink-0 ${check.status === "COMPLETED" ? "text-success" : "text-border-strong"}`}
                />
                <p className="truncate text-xs font-medium">{humanize(check.type)}</p>
              </div>
              <CandidateStatus value={check.status} />
            </div>
          ))
        ) : (
          <p className="rounded-[1rem] border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
            Checks will appear after the verification package is confirmed.
          </p>
        )}
      </div>

      {data.clarifications.length ? (
        <div className="mt-5 border-t border-border/70 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold">Information requests</h3>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Your secure reply is added directly to this case.
              </p>
            </div>
            <span className="num rounded-full bg-warning-soft px-2.5 py-1 text-[10px] text-warning-foreground">
              {data.clarifications.length}
            </span>
          </div>
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
    onSuccess: () => {
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["candidate-portal", accessId, token] });
    },
  });

  return (
    <article className="rounded-[1.15rem] border border-warning/15 bg-warning-soft/60 p-3.5">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/80 text-warning-foreground">
          <MessageSquareText className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold">{item.subject}</p>
            <CandidateStatus value={item.status} />
          </div>
          {item.dueAt ? (
            <p className="mt-1 text-[10px] text-warning-foreground">
              Reply by {formatDate(item.dueAt)}
            </p>
          ) : null}
          <div className="mt-3 space-y-2">
            {item.messages.map((entry, index) => (
              <div
                key={`${entry.createdAt}-${index}`}
                className={`max-w-[92%] rounded-[0.9rem] px-3 py-2.5 ${entry.sender === "CANDIDATE" ? "ml-auto bg-mint-deep text-white" : "bg-white/85"}`}
              >
                <p
                  className={`text-[9px] font-semibold uppercase tracking-wide ${entry.sender === "CANDIDATE" ? "text-white/55" : "text-muted-foreground"}`}
                >
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
                className="w-full resize-none rounded-[1rem] border border-input bg-white/90 px-3 py-2.5 text-xs leading-5 outline-none focus:ring-2 focus:ring-primary/15"
              />
              {response.isError ? (
                <p className="mt-1 text-[10px] text-destructive">{response.error.message}</p>
              ) : null}
              <button
                type="button"
                onClick={() => response.mutate()}
                disabled={message.trim().length < 2 || response.isPending}
                className="mt-2 inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {response.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
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
