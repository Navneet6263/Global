import { Activity, ArrowUpRight, CalendarDays, SearchX, UserRound } from "lucide-react";
import { useState } from "react";

import { humanize, money } from "@/components/crm/crm-utils";
import {
  opportunityStages,
  type CrmOverview,
  type Opportunity,
  type OpportunityStage,
} from "@/lib/api/crm";

const stageTone: Record<OpportunityStage, string> = {
  NEW: "bg-sky-50 text-sky-700",
  QUALIFIED: "bg-blue-50 text-blue-700",
  PROPOSAL: "bg-violet-50 text-violet-700",
  NEGOTIATION: "bg-amber-50 text-amber-700",
  WON: "bg-emerald-50 text-emerald-700",
  LOST: "bg-stone-100 text-stone-600",
};

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

export function OpportunityRegister({ items }: { items: Opportunity[] }) {
  const [stage, setStage] = useState<OpportunityStage | "ALL">("ALL");
  const visible = stage === "ALL" ? items : items.filter((item) => item.stage === stage);
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-sm font-bold">Deal register</h2>
          <p className="text-[10px] text-muted-foreground">
            Contacts, ownership, confidence and expected close
          </p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary/70 p-1">
          {(["ALL", ...opportunityStages] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStage(item)}
              className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-bold ${stage === item ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {item === "ALL" ? "All" : humanize(item)}
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="bg-secondary/35 text-[9px] uppercase tracking-[.11em] text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Account</th>
                <th className="px-3 py-2.5 font-semibold">Owner</th>
                <th className="px-3 py-2.5 font-semibold">Forecast</th>
                <th className="px-3 py-2.5 font-semibold">Probability</th>
                <th className="px-3 py-2.5 font-semibold">Expected close</th>
                <th className="px-5 py-2.5 font-semibold">Stage</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-border/60 text-xs transition hover:bg-orange-50/30"
                >
                  <td className="px-5 py-3">
                    <p className="font-bold">{item.companyName}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      {item.contactName}
                      {item.contactEmail ? ` · ${item.contactEmail}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <UserRound className="h-3 w-3" />
                      {item.owner?.displayName ?? "Unassigned"}
                    </span>
                  </td>
                  <td className="num px-3 py-3 font-bold">{money(Number(item.estimatedValue))}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${item.probability}%` }}
                        />
                      </div>
                      <span className="num text-[10px]">{item.probability}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {date(item.expectedCloseDate)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${stageTone[item.stage]}`}
                    >
                      {humanize(item.stage)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid h-36 place-items-center text-center">
          <div>
            <SearchX className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-[11px] font-semibold">No matching opportunities</p>
            <button
              type="button"
              onClick={() => setStage("ALL")}
              className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700"
            >
              Clear stage filter <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function date(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(value),
      )
    : "Not scheduled";
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
