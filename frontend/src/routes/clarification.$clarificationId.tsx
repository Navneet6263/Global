import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, LockKeyhole, MessageSquareText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { getPublicClarification, respondToClarification } from "@/lib/api/clarifications";

export const Route = createFileRoute("/clarification/$clarificationId")({
  component: ClarificationPage,
  head: () => ({ meta: [{ title: "Secure clarification — Sapling Global" }] }),
});

function ClarificationPage() {
  const { clarificationId } = Route.useParams();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [respondedAt, setRespondedAt] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setToken(params.get("token") ?? "");
  }, []);

  const clarification = useQuery({
    queryKey: ["public-clarification", clarificationId, token],
    queryFn: () => getPublicClarification(clarificationId, token),
    enabled: Boolean(token),
    retry: false,
  });
  const respond = useMutation({
    mutationFn: () => respondToClarification(clarificationId, token, message.trim()),
    onSuccess: (result) => setRespondedAt(result.respondedAt),
  });

  return (
    <main className="canvas-mesh min-h-screen bg-background px-4 py-8 text-foreground sm:py-14">
      <div className="mx-auto max-w-3xl">
        <Brand />
        {!token ? (
          <Unavailable message="The secure response token is missing from this link." />
        ) : null}
        {clarification.isLoading ? (
          <div className="surface h-96 animate-pulse rounded-[2rem]" />
        ) : null}
        {clarification.isError ? <Unavailable message={clarification.error.message} /> : null}
        {clarification.data ? (
          <section className="surface-float overflow-hidden rounded-[2rem]">
            <header className="ink-panel p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                {clarification.data.caseNumber}
              </p>
              <h1 className="mt-3 text-3xl font-bold">Additional information required</h1>
              <p className="mt-2 text-sm opacity-65">
                Respond securely to the Sapling Global verification team.
              </p>
            </header>
            <div className="space-y-5 p-6 sm:p-8">
              <div className="rounded-3xl border border-[var(--hairline)] bg-secondary/35 p-5">
                <div className="flex items-start gap-3">
                  <MessageSquareText className="mt-0.5 h-5 w-5 text-accent-foreground" />
                  <div>
                    <h2 className="font-semibold">{clarification.data.subject}</h2>
                    {clarification.data.dueAt ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested by {formatDate(clarification.data.dueAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {clarification.data.messages.map((entry, index) => (
                    <div
                      key={`${entry.createdAt}-${index}`}
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${entry.sender === "CANDIDATE" ? "ml-auto bg-primary text-primary-foreground" : "bg-background"}`}
                    >
                      {entry.body}
                    </div>
                  ))}
                </div>
              </div>

              {respondedAt ? (
                <div className="rounded-3xl bg-accent/15 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-accent-foreground" />
                  <h2 className="mt-3 text-lg font-bold">Response received</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Recorded securely on {formatDate(respondedAt)}. You may close this page.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (message.trim().length >= 2) respond.mutate();
                  }}
                  className="rounded-3xl border border-[var(--hairline)] p-5"
                >
                  <label className="text-sm font-semibold">
                    Your response
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      maxLength={5000}
                      rows={6}
                      placeholder="Provide the requested information clearly. Do not include unrelated sensitive data."
                      className="mt-3 w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring/25"
                    />
                  </label>
                  {respond.isError ? (
                    <p className="mt-3 text-sm text-destructive">{respond.error.message}</p>
                  ) : null}
                  <button
                    disabled={message.trim().length < 2 || respond.isPending}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {respond.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Send secure response
                  </button>
                </form>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2.5">
      <span className="ink-panel grid h-11 w-11 place-items-center rounded-2xl">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <div>
        <p className="font-bold">Sapling Global</p>
        <p className="text-xs text-muted-foreground">Secure candidate response</p>
      </div>
    </div>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="surface rounded-[2rem] p-8 text-center">
      <LockKeyhole className="mx-auto h-7 w-7 text-destructive" />
      <h1 className="mt-4 text-xl font-bold">Clarification link is unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(value),
  );
}
