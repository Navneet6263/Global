import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { PublicPageShell } from "@/features/public/PublicPageShell";
import { PublicLoading, PublicUnavailable } from "@/features/public/PublicStates";
import { getPublicClarification, respondToClarification } from "@/lib/api/clarifications";
import { capturePublicLinkToken, clearPublicLinkToken } from "@/lib/auth/public-link-token";

export const Route = createFileRoute("/clarification/$clarificationId")({
  component: ClarificationPage,
  head: () => ({ meta: [{ title: "Secure clarification — Sapling Global" }] }),
});

function ClarificationPage() {
  const { clarificationId } = Route.useParams();
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [respondedAt, setRespondedAt] = useState("");

  useEffect(() => {
    setToken(capturePublicLinkToken(`clarification:${clarificationId}`));
  }, [clarificationId]);

  const accessToken = token ?? "";
  const clarification = useQuery({
    queryKey: ["public-clarification", clarificationId, accessToken],
    queryFn: () => getPublicClarification(clarificationId, accessToken),
    enabled: Boolean(accessToken),
    retry: false,
  });
  const respond = useMutation({
    mutationFn: () => respondToClarification(clarificationId, accessToken, message.trim()),
    onSuccess: (result) => {
      clearPublicLinkToken(`clarification:${clarificationId}`);
      setRespondedAt(result.respondedAt);
    },
  });

  return (
    <PublicPageShell context="Secure candidate response" width="compact">
      {token === null ? <PublicLoading label="Reading secure access token" /> : null}
      {token === "" ? (
        <PublicUnavailable
          title="Clarification link is unavailable"
          message="The secure response token is missing from this link."
        />
      ) : null}
      {clarification.isLoading ? <PublicLoading label="Loading clarification request" /> : null}
      {clarification.isError ? (
        <PublicUnavailable
          title="Clarification link is unavailable"
          message={clarification.error.message}
          onRetry={() => void clarification.refetch()}
        />
      ) : null}
      {clarification.data ? (
        <section className="surface-float overflow-hidden rounded-[1.75rem] p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-[1.4rem] bg-mint-deep p-5 text-white sm:p-7">
            <span
              aria-hidden
              className="absolute -right-12 -top-14 size-44 rounded-full bg-white/10"
            />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                  {clarification.data.caseNumber}
                </p>
                <h1 className="mt-5 text-3xl font-medium tracking-[-0.04em]">
                  Additional information required
                </h1>
                <p className="mt-2 text-xs leading-5 text-white/65">
                  Respond directly to the verification team through this protected case link.
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10">
                <MessageSquareText className="size-5" />
              </span>
            </div>
          </div>

          <div className="space-y-5 p-2 pt-5 sm:p-3 sm:pt-6">
            <div className="rounded-[1.2rem] bg-secondary/45 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                    Information request
                  </p>
                  <h2 className="mt-1.5 text-sm font-semibold">{clarification.data.subject}</h2>
                </div>
                {clarification.data.dueAt ? (
                  <span className="rounded-full bg-warning-soft px-3 py-1.5 text-[10px] font-medium text-warning-foreground">
                    Reply by {formatDate(clarification.data.dueAt)}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-2.5">
                {clarification.data.messages.map((entry, index) => (
                  <div
                    key={`${entry.createdAt}-${index}`}
                    className={`max-w-[92%] rounded-[1rem] px-4 py-3 text-xs leading-5 ${entry.sender === "CANDIDATE" ? "ml-auto bg-mint-deep text-white" : "bg-white/90"}`}
                  >
                    <p
                      className={`mb-1 text-[9px] font-semibold uppercase tracking-wide ${entry.sender === "CANDIDATE" ? "text-white/55" : "text-muted-foreground"}`}
                    >
                      {entry.sender === "CANDIDATE" ? "Your response" : "Verification team"}
                    </p>
                    <p className="whitespace-pre-wrap">{entry.body}</p>
                    <p
                      className={`mt-1.5 text-[9px] ${entry.sender === "CANDIDATE" ? "text-white/45" : "text-muted-foreground"}`}
                    >
                      {formatDate(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {respondedAt ? (
              <div className="rounded-[1.2rem] bg-success-soft p-6 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-success">
                  <CheckCircle2 className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Response received</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Recorded securely on {formatDate(respondedAt)}. You may close this page.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (message.trim().length >= 2) respond.mutate();
                }}
                className="rounded-[1.2rem] border border-white/80 bg-white/75 p-4 shadow-[var(--shadow-card)] sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary">
                    <ShieldCheck className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">Your secure response</h2>
                    <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                      Include only the requested facts. Avoid unrelated sensitive information.
                    </p>
                  </div>
                </div>
                <textarea
                  aria-label="Clarification response"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={5000}
                  rows={6}
                  placeholder="Provide the requested information clearly…"
                  className="mt-4 w-full resize-none rounded-[1rem] border border-input bg-secondary/30 px-4 py-3 text-xs leading-5 outline-none focus:ring-2 focus:ring-primary/15"
                />
                <div className="mt-1 flex justify-end text-[9px] text-muted-foreground">
                  <span className="num">{message.length}/5000</span>
                </div>
                {respond.isError ? (
                  <p className="mt-3 rounded-xl bg-critical-soft px-3 py-2 text-xs text-critical-foreground">
                    {respond.error.message}
                  </p>
                ) : null}
                <button
                  disabled={message.trim().length < 2 || respond.isPending}
                  aria-busy={respond.isPending}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-card)] disabled:opacity-45"
                >
                  {respond.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {respond.isPending ? "Sending securely" : "Send secure response"}
                </button>
              </form>
            )}
          </div>
        </section>
      ) : null}
    </PublicPageShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
