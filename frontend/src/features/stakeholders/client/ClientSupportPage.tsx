import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { RaiseSupportRequestForm } from "@/features/support/components/RaiseSupportRequestForm";
import { useMySupportRequests, useRaiseSupportRequest } from "@/features/support/hooks/use-support";
import { ClientWorkspaceHeader } from "./ClientWorkspaceHeader";
import { ClientEmpty, ClientPager, ClientPill } from "./ClientPageParts";
import { formatDate } from "./client-portal-utils";

export function ClientSupportPage() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  if (session.isPending) return <ListSkeleton rows={3} />;
  if (!session.data?.permissions.some((p) => p === "*" || p === "support:request")) {
    return (
      <ErrorState
        title="Support access unavailable"
        description="Your account needs support-request access. Contact your administrator."
      />
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
          <Button onClick={() => setComposing(true)}>
            <MessageSquarePlus aria-hidden /> New request
          </Button>
        }
      />
      <div className="client-support-layout">
        <section className="client-register" aria-label="Your support requests">
          <div className="client-register-title">
            <div>
              <h2>Your requests</h2>
              <p>Only requests raised from your account are listed here.</p>
            </div>
            <span className="client-register-meta" role="status">
              {requests.isFetching
                ? "Updating…"
                : requests.isError
                  ? "Results unavailable"
                  : data
                    ? `${data.total} requests`
                    : "Loading…"}
            </span>
          </div>
          {requests.isError && (
            <ErrorState
              description={requests.error.message}
              onRetry={() => void requests.refetch()}
              retrying={requests.isFetching}
            />
          )}
          {requests.isPending ? (
            <ListSkeleton rows={4} />
          ) : (
            data && (
              <>
                <div className="client-support-list">
                  {data.items.map((request) => (
                    <article key={request.id}>
                      <div className="client-panel-head">
                        <h3>{request.subject}</h3>
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
                      <p className="client-muted">
                        {request.requestNumber} · {formatDate(request.createdAt)}
                        {request.caseNumber ? ` · ${request.caseNumber}` : ""}
                      </p>
                      {request.reply ? (
                        <div className="client-support-reply">
                          <strong>Support reply</strong>
                          <p>{request.reply}</p>
                        </div>
                      ) : (
                        <p className="client-support-wait">
                          {request.status === "RESOLVED"
                            ? "This request has been resolved."
                            : "Your request is with the support team. Their response will appear here."}
                        </p>
                      )}
                      <small className="client-muted">
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
        </section>
        <aside ref={composeRef} className="client-panel client-support-compose">
          <h2>{composing ? "New support request" : "How can we help?"}</h2>
          <p className="client-muted">
            Include the case number when your query is about a candidate.
          </p>
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
            <div className="client-support-guide">
              <h3>Make your request easy to resolve</h3>
              <ol>
                <li>Give the issue a short, clear subject.</li>
                <li>Add the case number, if available.</li>
                <li>Describe the problem and what you tried.</li>
              </ol>
              <Button variant="outline" onClick={() => setComposing(true)}>
                Write a request
              </Button>
            </div>
          )}
          <p className="client-note">
            Never include passwords, OTPs or full identity-document numbers in a support message.
          </p>
        </aside>
      </div>
    </>
  );
}
