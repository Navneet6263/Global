import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import type { OpsClarification } from "@/features/operations/contracts/case";
import type { ClarificationQuery } from "@/features/operations/contracts/operations";
import { OPS_CLARIFICATION_STATE_META } from "@/features/operations/contracts/case";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useClarificationAction,
  useOpsClarifications,
} from "@/features/operations/hooks/use-operations";
import { formatDateTime, formatRelativeToNow } from "@/lib/formatting";

export const Route = createFileRoute("/operations/clarifications")({
  head: () => ({
    meta: [
      { title: "Clarifications — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Track candidate and client clarification threads, chase overdue responses and close them out.",
      },
      { property: "og:title", content: "Clarifications — Sapling Global Operations" },
      {
        property: "og:description",
        content:
          "Every open clarification thread with due dates, reminders and resolution actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClarificationsPage,
});

const FILTERS: readonly { value: NonNullable<ClarificationQuery["state"]>; label: string }[] = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "awaiting_candidate", label: "Awaiting candidate" },
  { value: "awaiting_client", label: "Awaiting client" },
  { value: "response_received", label: "Response received" },
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved" },
];

function ClarificationsPage() {
  const [query, setQuery] = useState<ClarificationQuery>({ state: "all" });
  const { data, isPending, isError, isFetching, refetch } = useOpsClarifications(query);
  const action = useClarificationAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clarifications"
        description="Chase pending responses from candidates and clients, then review and close each thread."
        meta={data ? `${data.length} threads in this view` : undefined}
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      <div className="surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
          <Input
            placeholder="Search subject, candidate or case"
            value={query.search ?? ""}
            onChange={(event) =>
              setQuery((current) => ({ ...current, search: event.target.value || undefined }))
            }
            className="h-9 w-full sm:w-64"
          />
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => (
              <Button
                key={filter.value}
                size="sm"
                variant={query.state === filter.value ? "default" : "outline"}
                onClick={() => setQuery((current) => ({ ...current, state: filter.value }))}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {isPending ? (
          <div className="p-5">
            <ListSkeleton rows={5} />
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={MessagesSquare}
              title="No clarification threads here"
              description="Switch the filter to see threads in other states."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data!.map((thread) => (
              <ClarificationRow
                key={thread.id}
                thread={thread}
                busy={action.isPending}
                onAction={(kind) => action.mutate({ clarificationId: thread.id, action: kind })}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ClarificationRow({
  thread,
  busy,
  onAction,
}: {
  thread: OpsClarification;
  busy: boolean;
  onAction: (kind: "remind" | "resolve" | "request_again" | "review") => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = OPS_CLARIFICATION_STATE_META[thread.state];
  const last = thread.messages.at(-1);

  return (
    <li className="space-y-2 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={meta.label} tone={meta.tone} />
        <span className="text-[13px] font-medium text-foreground">{thread.subject}</span>
        <span className="num text-[11px] text-muted-foreground">{thread.caseNumber}</span>
        {thread.overdue ? <StatusBadge label="Overdue" tone="critical" /> : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {thread.candidateName} · {thread.clientName} · {thread.checkLabel} · raised by{" "}
        {thread.requestedBy} · due {formatDateTime(thread.dueAt)}
      </p>
      {last ? (
        <p className="text-[12px] text-foreground/85">
          <span className="text-muted-foreground">{last.author}:</span> {last.body}
        </p>
      ) : null}

      {open ? (
        <ul className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
          {thread.messages.map((message) => (
            <li key={message.id} className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground">
                {message.author} · {formatRelativeToNow(message.at)}
              </p>
              <p className="text-[12px] text-foreground/90">{message.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? "Hide thread" : `View thread (${thread.messages.length})`}
        </Button>
        {thread.state !== "resolved" ? (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("remind")}>
              Send reminder
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("review")}>
              Mark under review
            </Button>
            <Button size="sm" disabled={busy} onClick={() => onAction("resolve")}>
              Resolve
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}
