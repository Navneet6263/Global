import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { ChartSkeleton } from "@/components/feedback/skeletons";
import { useOpsTeam } from "@/features/operations/hooks/use-operations";
import { OpsPeople } from "@/features/operations/team/OpsPeople";
import { TeamWorkload } from "@/features/operations/team/TeamWorkload";
import { OpsCreateUserAction } from "@/features/operations/user-creation/ops-create-user-action";

export const Route = createFileRoute("/operations/team")({
  head: () => ({
    meta: [
      { title: "Team — Sapling Global Operations" },
      {
        name: "description",
        content: "Team workload, who has room, and every user ID in your scope.",
      },
    ],
  }),
  component: TeamPage,
});

type Tab = "workload" | "people";

function TeamPage() {
  const [tab, setTab] = useState<Tab>("workload");
  const { data, isPending, isError, isFetching, refetch } = useOpsTeam();
  const members = data?.members ?? [];
  const totals = {
    people: members.length,
    open: members.reduce((sum, member) => sum + member.activeChecks, 0),
    dueToday: members.reduce((sum, member) => sum + member.dueToday, 0),
    overdue: members.reduce((sum, member) => sum + member.overdue, 0),
  };

  return (
    <div className="team-page">
      <header className="client-heading">
        <div>
          <h1>Team</h1>
          <p>See who is loaded and who has room, and create user IDs for your team.</p>
        </div>
        <div className="client-heading-actions">
          <OpsCreateUserAction />
        </div>
      </header>

      {data ? (
        <div className="team-kpis" role="list" aria-label="Team summary">
          <div role="listitem">
            <small>Team members</small>
            <strong>{totals.people}</strong>
          </div>
          <div role="listitem">
            <small>Open checks</small>
            <strong>{totals.open}</strong>
            <span>{data.openAssignments} waiting to be allocated</span>
          </div>
          <div role="listitem" className={totals.dueToday ? "is-warn" : ""}>
            <small>Due today</small>
            <strong>{totals.dueToday}</strong>
          </div>
          <div role="listitem" className={totals.overdue ? "is-bad" : "is-good"}>
            <small>Overdue</small>
            <strong>{totals.overdue}</strong>
          </div>
        </div>
      ) : null}

      <div className="team-tabs" role="tablist" aria-label="Team views">
        {(
          [
            ["workload", "Workload"],
            ["people", "People & IDs"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "is-active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "people" ? (
        <OpsPeople />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} retrying={isFetching} />
      ) : isPending || !data ? (
        <ChartSkeleton height={320} />
      ) : (
        <TeamWorkload data={data} />
      )}
    </div>
  );
}
