"use client";

import { useNavigate } from "@tanstack/react-router";
import type { CrmOverview, FollowUp } from "../contracts/crm";
import { CrmRevenueHero } from "./crm-revenue-hero";
import { CrmTrendCard } from "./crm-trend-card";
import { CrmMetricCard } from "./crm-metric-card";
import { CrmStageBars } from "./crm-stage-bars";
import { CrmFollowUpPanel } from "./crm-followup-panel";
import { CrmActivityFeed } from "./crm-activity-feed";

interface CrmOverviewGridProps {
  overview: CrmOverview;
  onCreate: () => void;
  onCompleteFollowUp: (followUp: FollowUp) => void;
  onRescheduleFollowUp: (followUp: FollowUp) => void;
  onOpenFollowUp: (followUp: FollowUp) => void;
}

export function CrmOverviewGrid({
  overview,
  onCreate,
  onCompleteFollowUp,
  onRescheduleFollowUp,
  onOpenFollowUp,
}: CrmOverviewGridProps) {
  const navigate = useNavigate();
  const metric = (id: string) => overview.metrics.find((row) => row.id === id);
  const openPipeline = metric("openPipeline");
  const tiles = overview.metrics.filter((row) => row.id !== "openPipeline");

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        {openPipeline ? (
          <CrmRevenueHero
            openPipeline={openPipeline}
            closedWon={metric("closedWon")}
            onCreate={onCreate}
          />
        ) : null}
        <CrmTrendCard trend={overview.trend} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((row) => (
          <CrmMetricCard
            key={row.id}
            metric={row}
            onSelect={() => {
              if (row.id === "overdueFollowUps") {
                void navigate({ to: "/sales-crm/follow-ups", search: { view: "overdue" } });
                return;
              }
              if (row.id === "activeOwners") {
                void navigate({ to: "/sales-crm/team" });
                return;
              }
              void navigate({ to: "/sales-crm/forecast" });
            }}
          />
        ))}
      </div>

      <CrmStageBars
        stages={overview.stages}
        onSelectStage={(stage) =>
          void navigate({ to: "/sales-crm/opportunities", search: { stage, view: "table" } })
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CrmFollowUpPanel
          followUps={overview.followUps}
          onComplete={onCompleteFollowUp}
          onReschedule={onRescheduleFollowUp}
          onOpen={onOpenFollowUp}
        />
        <CrmActivityFeed activities={overview.activities} />
      </div>
    </div>
  );
}
