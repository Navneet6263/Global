import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquare,
  Rocket,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  getOnboardingActivity,
  type OnboardingActivityItem,
  type OnboardingActivityKind,
} from "@/lib/backend-api/onboarding";
import { activityDay, activityLabel, activityTime } from "./onboarding-format";

const PAGE_SIZE = 8;

const FILTERS: ReadonlyArray<{ id: OnboardingActivityKind | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "DOCUMENTS", label: "Documents" },
  { id: "PRICING", label: "Pricing" },
  { id: "PEOPLE", label: "RM & messages" },
  { id: "DECISIONS", label: "Status" },
];

function iconOf(item: OnboardingActivityItem): LucideIcon {
  if (item.action === "client.onboarding.message") return MessageSquare;
  if (item.action === "client.onboarding.activated") return BadgeCheck;
  if (item.kind === "DOCUMENTS") return FileText;
  if (item.kind === "PRICING") return BadgePercent;
  if (item.kind === "PEOPLE") return UserRound;
  return Rocket;
}

/** Who did what and when for one company, newest first, grouped by day, paged. */
export function OnboardingActivity({ clientId }: { clientId: string }) {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<OnboardingActivityKind | "ALL">("ALL");
  const activity = useQuery({
    queryKey: ["onboarding", "activity", clientId, kind, page],
    queryFn: () =>
      getOnboardingActivity(clientId, {
        page,
        pageSize: PAGE_SIZE,
        kind: kind === "ALL" ? undefined : kind,
      }),
    placeholderData: keepPreviousData,
  });
  const items = activity.data?.items ?? [];
  const total = activity.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, page * PAGE_SIZE);
  const days = items.reduce<Array<{ day: string; rows: OnboardingActivityItem[] }>>(
    (groups, item) => {
      const day = activityDay(item.at);
      const last = groups.at(-1);
      if (last?.day === day) last.rows.push(item);
      else groups.push({ day, rows: [item] });
      return groups;
    },
    [],
  );

  return (
    <section className="onb-sheet-section onb-activity" aria-label="Activity">
      <div className="onb-activity-head">
        <h3>Activity</h3>
        {total ? <span>{total} events</span> : null}
      </div>
      <div className="onb-activity-filters" role="group" aria-label="Filter activity">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={kind === filter.id}
            className={kind === filter.id ? "is-active" : ""}
            onClick={() => {
              setKind(filter.id);
              setPage(1);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {activity.isError ? (
        <p role="alert" className="onb-activity-empty">
          {activity.error.message}
        </p>
      ) : activity.isLoading ? (
        <p className="onb-activity-empty">Loading activity…</p>
      ) : !items.length ? (
        <p className="onb-activity-empty">Nothing here yet.</p>
      ) : (
        <div className={activity.isFetching ? "onb-activity-body is-loading" : "onb-activity-body"}>
          {days.map((group) => (
            <div key={group.day} className="onb-activity-day">
              <p className="onb-activity-date">{group.day}</p>
              <ol aria-label={`Activity on ${group.day}`}>
                {group.rows.map((item) => {
                  const Icon = iconOf(item);
                  return (
                    <li key={item.id} className={item.outcome ? `is-${item.outcome}` : ""}>
                      <span className="onb-activity-icon" aria-hidden>
                        <Icon />
                      </span>
                      <div className="min-w-0">
                        <p className="onb-activity-title">
                          <strong>{activityLabel(item.action)}</strong>
                          <time dateTime={item.at}>{activityTime(item.at)}</time>
                        </p>
                        {item.detail ? <p className="onb-activity-detail">{item.detail}</p> : null}
                        <p className="onb-activity-by">
                          {item.by}
                          {item.byRole && item.byRole !== item.by ? ` · ${item.byRole}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE ? (
        <footer className="onb-activity-pager">
          <span>
            {from}–{to} of {total}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => value - 1)}
            disabled={page <= 1}
            aria-label="Newer activity"
          >
            <ChevronLeft aria-hidden /> Newer
          </button>
          <button
            type="button"
            onClick={() => setPage((value) => value + 1)}
            disabled={page >= pages}
            aria-label="Older activity"
          >
            Older <ChevronRight aria-hidden />
          </button>
        </footer>
      ) : null}
    </section>
  );
}
