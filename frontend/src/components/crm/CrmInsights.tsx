import { Activity } from "lucide-react";

import type { CrmOverview } from "@/lib/api/crm";

export function CrmActivity({ activities }: { activities: CrmOverview["activities"] }) {
  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-700">
          <Activity className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold">Activity stream</h2>
          <p className="text-[10px] text-muted-foreground">Latest audited commercial movement</p>
        </div>
      </div>
      <div className="relative mt-4 space-y-0 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-border">
        {activities.length ? (
          activities.slice(0, 8).map((activity) => (
            <article
              key={activity.id}
              className="relative grid grid-cols-[12px_1fr] gap-3 py-2.5 first:pt-0"
            >
              <span className="relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500 ring-1 ring-orange-200" />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-bold">
                    {activity.opportunity.companyName}
                  </p>
                  <span className="shrink-0 text-[9px] text-muted-foreground">
                    {relativeTime(activity.occurredAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                  {activity.summary}
                </p>
                <p className="mt-1 text-[9px] font-medium text-foreground/70">
                  {activity.actor.displayName}
                </p>
              </div>
            </article>
          ))
        ) : (
          <div className="grid h-36 place-items-center text-[10px] text-muted-foreground">
            No commercial activity yet.
          </div>
        )}
      </div>
    </section>
  );
}

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(
    new Date(value),
  );
}
