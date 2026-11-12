import { useQuery } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClarificationPortalMode } from "@/lib/backend-api/clarifications-l2-types";
import {
  getSharedL2Clarifications,
  type SharedL2QueueQuery,
} from "@/lib/backend-api/clarifications-shared";
import { SharedL2ClarificationRow } from "./SharedL2ClarificationRow";

const STATUS_FILTERS = [
  { value: "", label: "Active queue" },
  { value: "CANDIDATE_SUBMITTED", label: "Pending review" },
  { value: "DATA_ENTRY_PENDING", label: "With Data Entry" },
  { value: "OPEN", label: "Awaiting candidate" },
  { value: "ALL", label: "All (incl. resolved)" },
] as const;

/** Shared L2 Document Clarifications queue for Operations and Client-mapped SPOC-RM. */
export function SharedL2ClarificationsPanel({
  mode,
  embedded = false,
}: {
  mode: ClarificationPortalMode;
  embedded?: boolean;
}) {
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const queue = useQuery({
    queryKey: ["clarifications", "shared-l2", mode, status, search],
    queryFn: () =>
      getSharedL2Clarifications(mode, {
        status: (status || undefined) as SharedL2QueueQuery["status"],
        search,
      }),
  });

  const items = queue.data?.items ?? [];
  const dataEntryUsers = queue.data?.dataEntryUsers ?? [];

  return (
    <section
      aria-label="L2 Document Clarifications"
      className={embedded ? "overflow-hidden" : "surface overflow-hidden"}
    >
      {embedded ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">
              L2 Document Clarifications
            </h2>
            <p className="text-[11.5px] text-muted-foreground">
              Inspect candidate corrected document submissions and hand off to Data Entry for
              re-entry.
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {items.length} shown
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <Input
          placeholder="Search candidate, Sapling ID, client or subject"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 w-full sm:w-64"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.label}
              size="sm"
              variant={status === filter.value ? "default" : "outline"}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        {embedded ? (
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {items.length} shown
          </span>
        ) : null}
      </div>

      {queue.isError ? (
        <div className={embedded ? "p-4" : "p-5"}>
          <ErrorState onRetry={() => void queue.refetch()} retrying={queue.isFetching} />
        </div>
      ) : queue.isPending ? (
        <div className={embedded ? "p-4" : "p-5"}>
          <ListSkeleton rows={3} />
        </div>
      ) : items.length === 0 ? (
        <div className={embedded ? "p-4" : "p-5"}>
          <EmptyState
            icon={FileCheck2}
            title="No L2 document clarifications in this filter"
            description="Candidate corrected uploads and Data Entry handoffs will appear here."
            className={embedded ? "py-6" : undefined}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <SharedL2ClarificationRow
              key={item.id}
              mode={mode}
              item={item}
              dataEntryUsers={dataEntryUsers}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
