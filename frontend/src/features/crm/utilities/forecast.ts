import { CRM_TARGETS, STAGE_LABEL } from "../config/crm";
import type {
  CrmTrendPoint,
  ForecastBucket,
  ForecastQuery,
  Opportunity,
  RevenueForecast,
  SalesOwner,
} from "../contracts/crm";
import { closedWonValue, isActive, openPipelineValue, weightedForecastValue } from "./metrics";

const DAY_MS = 86_400_000;

export function buildForecast(
  filters: ForecastQuery,
  opportunities: readonly Opportunity[],
  owners: readonly SalesOwner[],
  monthly: readonly CrmTrendPoint[],
  calendar: readonly { date: string; count: number; value: number }[],
  now: number,
): RevenueForecast {
  const period = filters.period ?? "month";

  const scoped = opportunities.filter((row) => {
    if (filters.owner && filters.owner !== "all" && row.ownerId !== filters.owner) return false;
    if (filters.stage && filters.stage !== "all" && row.stage !== filters.stage) return false;
    if (filters.source && filters.source !== "all" && row.source !== filters.source) return false;
    if (filters.minValue && row.estimatedValue < filters.minValue) return false;
    return true;
  });

  const active = scoped.filter(isActive);
  const openPipeline = openPipelineValue(scoped);
  const weighted = weightedForecastValue(scoped);
  const commit = active
    .filter((row) => row.probability >= 70)
    .reduce((sum, row) => sum + row.estimatedValue, 0);
  const bestCase = active
    .filter((row) => row.probability >= 30)
    .reduce((sum, row) => sum + row.estimatedValue, 0);
  const closedWon = closedWonValue(scoped);
  const target =
    period === "month"
      ? CRM_TARGETS.monthly
      : period === "quarter"
        ? CRM_TARGETS.quarterly
        : CRM_TARGETS.yearly;

  const byOwner: ForecastBucket[] = owners
    .map((owner) => ({
      label: owner.name,
      value: owner.pipelineValue,
      weighted: owner.weightedForecast,
    }))
    .sort((a, b) => b.weighted - a.weighted);

  const stageMap = new Map<string, ForecastBucket>();
  for (const row of active) {
    const label = STAGE_LABEL[row.stage];
    const bucket = stageMap.get(label) ?? { label, value: 0, weighted: 0 };
    bucket.value += row.estimatedValue;
    bucket.weighted += Math.round((row.estimatedValue * row.probability) / 100);
    stageMap.set(label, bucket);
  }

  const atRisk = active
    .filter(
      (row) =>
        Date.parse(row.expectedCloseDate) - now < 14 * DAY_MS &&
        (row.probability < 60 ||
          row.lastActivityAt === null ||
          now - Date.parse(row.lastActivityAt) > 10 * DAY_MS),
    )
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, 6);

  return {
    period,
    openPipeline,
    weightedForecast: weighted,
    commitForecast: commit,
    bestCaseForecast: bestCase,
    closedWon,
    target,
    gapToTarget: Math.max(0, target - (closedWon + weighted)),
    monthly,
    byOwner,
    byStage: [...stageMap.values()],
    calendar,
    atRisk,
  };
}
