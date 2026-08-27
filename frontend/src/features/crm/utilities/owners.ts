import type { FollowUp, Opportunity, SalesActivity, SalesOwner } from "../contracts/crm";
import {
  closedWonValue,
  isActive,
  openPipelineValue,
  overdueFollowUps,
  weightedForecastValue,
  winRatePercent,
} from "./metrics";

export interface OwnerSeed {
  id: string;
  name: string;
  email: string;
  territory: string;
}

const WEEK_MS = 7 * 86_400_000;

function sameMonth(iso: string, now: number): boolean {
  const date = new Date(iso);
  const reference = new Date(now);
  return (
    date.getUTCMonth() === reference.getUTCMonth() &&
    date.getUTCFullYear() === reference.getUTCFullYear()
  );
}

export function buildSalesOwners(
  seeds: readonly OwnerSeed[],
  opportunities: readonly Opportunity[],
  followUps: readonly FollowUp[],
  activities: readonly SalesActivity[],
  now: number,
): SalesOwner[] {
  const overdue = overdueFollowUps(followUps, now);

  return seeds.map((seed) => {
    const owned = opportunities.filter((row) => row.ownerId === seed.id);
    const ownedIds = new Set(owned.map((row) => row.id));

    return {
      id: seed.id,
      name: seed.name,
      email: seed.email,
      territory: seed.territory,
      activeOpportunities: owned.filter(isActive).length,
      pipelineValue: openPipelineValue(owned),
      weightedForecast: weightedForecastValue(owned),
      wonRevenue: closedWonValue(owned),
      winRate: Math.round(winRatePercent(owned) * 10) / 10,
      overdueFollowUps: overdue.filter((row) => ownedIds.has(row.opportunityId)).length,
      activitiesThisWeek: activities.filter(
        (row) => ownedIds.has(row.opportunityId) && now - Date.parse(row.occurredAt) <= WEEK_MS,
      ).length,
      closingThisMonth: owned.filter(
        (row) => isActive(row) && sameMonth(row.expectedCloseDate, now),
      ).length,
    };
  });
}
