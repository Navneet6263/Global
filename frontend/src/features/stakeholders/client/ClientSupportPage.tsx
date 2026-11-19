import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/api/auth";
import { Button, Card, CardHeader, EmptyState, ErrorText, Loading } from "@/kit";
import { RaiseSupportRequestForm } from "@/features/support/components/RaiseSupportRequestForm";
import { useMySupportRequests, useRaiseSupportRequest } from "@/features/support/hooks/use-support";
import { ClientWorkspaceHeader } from "./ClientWorkspaceHeader";
import { ClientEmpty, ClientPager, ClientPill } from "./ClientPageParts";
import { formatDate } from "./client-portal-utils";

export function ClientSupportPage() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  if (session.isPending) return <Loading />;
  if (!session.data?.permissions.some((p) => p === "*" || p === "support:request")) {
    return (
      <EmptyState title="Support access unavailable">
        Your account needs support-request access. Contact your administrator.
      </EmptyState>
    );
  }
  return <ClientSupportWorkspace />;
}

function ClientSupportWorkspace() {
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const composeRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (composing) composeRef.current?.querySelector("input")?.focus();
  }, [composing]);
  const requests = useMySupportRequests(page, true, 6);
  const create = useRaiseSupportRequest(() => {
    setPage(1);
    setComposing(false);
  });
  const data = requests.data;
  return (
    <>
      <ClientWorkspaceHeader
        title="Queries & support"
        description="Raise a query and follow your support team's response."
        actions={
          <Button variant="primary" onClick={() => setComposing(true)}>
            <MessageSquarePlus aria-hidden /> New request
          </Button>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card label="Your support requests" className="min-w-0">
          <CardHeader
            title="Your requests"
            description="Only requests raised from your account are listed here."
            aside={
              <span className="text-xs" role="status">
                {requests.isFetching
                  ? "Updating…"
                  : requests.isError
                    ? "Results unavailable"
                    : data
                      ? `${data.total} requests`
                      : "Loading…"}
              </span>
            }
          />
          {requests.isError && (
            <ErrorText onRetry={() => void requests.refetch()} retrying={requests.isFetching}>
              {requests.error.message}
            </ErrorText>
          )}
          {requests.isPending ? (
            <Loading>Loading requests…</Loading>
          ) : (
            data && (
              <>
                <div className="divide-y divide-line">
                  {data.items.map((request) => (
                    <article key={request.id} className="flex flex-col gap-2 px-4 py-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="min-w-0 font-semibold break-words text-ink">
                          {request.subject}
                        </h3>
                        <ClientPill
                          tone={
                            request.status === "RESOLVED"
                              ? "green"
                              : request.status === "IN_PROGRESS"
                                ? "blue"
                                : "amber"
                          }
                        >
                          {request.status.replaceAll("_", " ")}
                        </ClientPill>
                      </div>
                      <p className="text-xs text-dim">
                        <span className="font-mono">{request.requestNumber}</span> ·{" "}
                        {formatDate(request.createdAt)}
                        {request.caseNumber ? (
                          <>
                            {" · "}
                            <span className="font-mono">{request.caseNumber}</span>
                          </>
                        ) : null}
                      </p>
                      {request.reply ? (
                        <div className="rounded-md border-l-2 border-brand bg-brand-soft px-3 py-2">
                          <strong className="text-[11px] font-semibold tracking-wider text-brand uppercase">
                            Support reply
                          </strong>
                          <p className="mt-0.5 text-sm whitespace-pre-line text-ink">
                            {request.reply}
                          </p>
                        </div>
                      ) : (
                        <p className="rounded-md bg-subtle px-3 py-2 text-sm text-dim">
                          {request.status === "RESOLVED"
                            ? "This request has been resolved."
                            : "Your request is with the support team. Their response will appear here."}
                        </p>
                      )}
                      <small className="text-xs text-dim">
                        Last updated {formatDate(request.updatedAt)}
                      </small>
                    </article>
                  ))}
                </div>
                {!data.items.length && (
                  <ClientEmpty title="No requests on this page">
                    Need assistance? Use New request to contact the support team.
                  </ClientEmpty>
                )}
              </>
            )
          )}
          <ClientPager
            page={page}
            previous={page > 1}
            busy={requests.isFetching || requests.isError}
            next={!!data && page * data.pageSize < data.total}
            onPrevious={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
            detail="Status and replies update when you refresh."
          />
        </Card>
        <aside
          ref={composeRef}
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-soft lg:sticky lg:top-4"
        >
          <div>
            <h2 className="text-[15px] font-semibold text-ink">
              {composing ? "New support request" : "How can we help?"}
            </h2>
            <p className="mt-0.5 text-xs text-dim">
              Include the case number when your query is about a candidate.
            </p>
          </div>
          {composing ? (
            <>
              <RaiseSupportRequestForm
                withCaseNumber
                busy={create.isPending}
                onSubmit={(input, reset) => create.mutate(input, { onSuccess: reset })}
              />
              <Button
                variant="ghost"
                disabled={create.isPending}
                onClick={() => setComposing(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-ink">Make your request easy to resolve</h3>
              <ol className="flex flex-col gap-2 text-sm text-ink">
                {[
                  "Give the issue a short, clear subject.",
                  "Add the case number, if available.",
                  "Describe the problem and what you tried.",
                ].map((tip, index) => (
                  <li key={tip} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[11px] font-semibold text-brand"
                    >
                      {index + 1}
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ol>
              <Button onClick={() => setComposing(true)}>Write a request</Button>
            </div>
          )}
          <p className="flex gap-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-ink">
            <ShieldAlert className="mt-px size-3.5 shrink-0 text-warn" aria-hidden />
            Never include passwords, OTPs or full identity-document numbers in a support message.
          </p>
        </aside>
      </div>
    </>
  );
}
