import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ClarificationPortalMode,
  SharedL1QueueState,
} from "@/lib/backend-api/clarifications-l2-types";
import { getSharedL1Clarifications } from "@/lib/backend-api/clarifications-shared";
import { SharedL1ClarificationRow } from "./SharedL1ClarificationRow";

const FILTERS: readonly { value: SharedL1QueueState; label: string }[] = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "awaiting_client", label: "Awaiting response" },
  { value: "response_received", label: "Response received" },
];

/** Shared Candidate & Client Clarifications (L1 / Threads) for Operations and RM. */
export function SharedL1ClarificationsPanel({
  mode,
  embedded = false,
}: {
  mode: ClarificationPortalMode;
  embedded?: boolean;
}) {
  const [state, setState] = useState<SharedL1QueueState>("all");
  const [search, setSearch] = useState("");
  const queue = useQuery({
    queryKey: ["clarifications", "shared-l1", mode, state, search],
    queryFn: () => getSharedL1Clarifications(mode, { state, search }),
  });

  const items = queue.data?.items ?? [];

  return (
    <section
      aria-label="Candidate & Client Clarifications (L1 / Threads)"
      className={embedded ? "overflow-hidden" : "surface overflow-hidden"}
    >
      {embedded ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">
              Candidate &amp; Client Clarifications (L1 / Threads)
            </h2>
            <p className="text-[11.5px] text-muted-foreground">
              Track pending responses, inspect complete threads and resolve valid clarification
              replies.
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {items.length} threads in this view
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
        <Input
          placeholder="Search subject, candidate, client or case"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 w-full sm:w-64"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={state === filter.value ? "default" : "outline"}
              onClick={() => setState(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        {embedded ? (
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {items.length} threads
          </span>
        ) : null}
      </div>

      {queue.isError ? (
        <div className={embedded ? "p-4" : "p-5"}>
          <ErrorState onRetry={() => void queue.refetch()} retrying={queue.isFetching} />
        </div>
      ) : queue.isPending ? (
        <div className={embedded ? "p-4" : "p-5"}>
          <ListSkeleton rows={4} />
        </div>
      ) : items.length === 0 ? (
        <div className={embedded ? "p-4" : "p-5"}>
          <EmptyState
            icon={MessagesSquare}
            title="No clarification threads here"
            description="Switch the filter to see threads in other states."
            className={embedded ? "py-6" : undefined}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <SharedL1ClarificationRow key={item.id} mode={mode} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
