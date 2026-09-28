import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import type { SpocCaseDetail } from "../contracts/spoc";
import { useSpocCaseActivity } from "../hooks/use-spoc";
import { dateTime, label } from "../utils/spoc-format";

/** Status history plus the audited activity trail (who did what, when). */
export function SpocCaseTimeline({ item, active }: { item: SpocCaseDetail; active: boolean }) {
  const activity = useSpocCaseActivity(item.id, active);
  const events = activity.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold text-foreground">Stage history</h3>
        <ol className="space-y-2 border-l border-border pl-4">
          {item.statusHistory.map((entry) => (
            <li key={`${entry.createdAt}-${entry.toStatus}`} className="text-xs">
              <p className="font-medium text-foreground">
                {entry.fromStatus ? `${label(entry.fromStatus)} → ` : ""}
                {label(entry.toStatus)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {dateTime(entry.createdAt)}
                {entry.reason ? ` · ${entry.reason}` : ""}
              </p>
            </li>
          ))}
          {!item.statusHistory.length ? (
            <li className="text-[11px] text-muted-foreground">No stage change recorded yet.</li>
          ) : null}
        </ol>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold text-foreground">Activity</h3>
        {activity.isError ? (
          <ErrorState
            description={activity.error.message}
            onRetry={() => void activity.refetch()}
            retrying={activity.isFetching}
          />
        ) : activity.isPending ? (
          <ListSkeleton rows={3} />
        ) : (
          <ul className="divide-y divide-border/60 rounded-2xl border border-border bg-card/80">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-3 px-4 py-2.5 text-xs"
              >
                <span>
                  <span className="font-medium text-foreground">{label(event.action)}</span>
                  <span className="text-muted-foreground"> · {label(event.resourceType)}</span>
                </span>
                <span className="shrink-0 text-right text-[10px] text-muted-foreground">
                  {event.actorName}
                  <br />
                  {dateTime(event.createdAt)}
                </span>
              </li>
            ))}
            {!events.length ? (
              <li className="px-4 py-4 text-center text-[11px] text-muted-foreground">
                No recorded activity.
              </li>
            ) : null}
          </ul>
        )}
        {activity.hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void activity.fetchNextPage()}
            loading={activity.isFetchingNextPage}
          >
            Load older activity
          </Button>
        ) : null}
      </section>
    </div>
  );
}
