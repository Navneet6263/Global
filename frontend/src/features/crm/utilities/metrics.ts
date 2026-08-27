import type { StatusTone, TrendDirection } from "@/lib/contracts/common";
import { formatInr, formatNumber, formatPercent } from "@/lib/formatting";
import { ACTIVE_STAGES, CRM_STAGES } from "../config/crm";
import type {
  CrmMetric,
  CrmMetricId,
  CrmStage,
  CrmStageSnapshot,
  FollowUp,
  Opportunity,
} from "../contracts/crm";

const DAY_MS = 86_400_000;

export function isActive(opportunity: Opportunity): boolean {
  return ACTIVE_STAGES.includes(opportunity.stage);
}

export function openPipelineValue(rows: readonly Opportunity[]): number {
  return rows.filter(isActive).reduce((sum, row) => sum + row.estimatedValue, 0);
}

export function weightedForecastValue(rows: readonly Opportunity[]): number {
  return rows
    .filter(isActive)
    .reduce((sum, row) => sum + Math.round((row.estimatedValue * row.probability) / 100), 0);
}

export function closedWonValue(rows: readonly Opportunity[]): number {
  return rows
    .filter((row) => row.stage === "WON")
    .reduce((sum, row) => sum + (row.finalValue ?? row.estimatedValue), 0);
}

export function winRatePercent(rows: readonly Opportunity[]): number {
  const won = rows.filter((row) => row.stage === "WON").length;
  const lost = rows.filter((row) => row.stage === "LOST").length;
  if (won + lost === 0) return 0;
  return (won / (won + lost)) * 100;
}

export function overdueFollowUps(rows: readonly FollowUp[], now: number): FollowUp[] {
  return rows.filter((row) => row.completedAt === null && Date.parse(row.dueAt) < now);
}

export function activeOwnerIds(rows: readonly Opportunity[]): string[] {
  const set = new Set<string>();
  for (const row of rows) if (isActive(row) && row.ownerId) set.add(row.ownerId);
  return [...set];
}

export function ageInDays(iso: string, now: number): number {
  return Math.max(0, Math.round((now - Date.parse(iso)) / DAY_MS));
}

function delta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function direction(value: number): TrendDirection {
  if (value > 0.5) return "up";
  if (value < -0.5) return "down";
  return "flat";
}

interface MetricSeed {
  id: CrmMetricId;
  label: string;
  explanation: string;
  value: number;
  previousValue: number;
  display: string;
  previousDisplay: string;
  tone: StatusTone;
  series: readonly number[];
  invert?: boolean;
}

function toMetric(seed: MetricSeed): CrmMetric {
  const deltaPercent = delta(seed.value, seed.previousValue);
  return {
    id: seed.id,
    label: seed.label,
    explanation: seed.explanation,
    value: seed.value,
    display: seed.display,
    previousValue: seed.previousValue,
    previousDisplay: seed.previousDisplay,
    deltaPercent,
    direction: seed.invert ? direction(-deltaPercent) : direction(deltaPercent),
    tone: seed.tone,
    series: seed.series,
  };
}

export interface MetricSeriesMap {
  openPipeline: readonly number[];
  weightedForecast: readonly number[];
  closedWon: readonly number[];
  winRate: readonly number[];
  overdueFollowUps: readonly number[];
  activeOwners: readonly number[];
}

export function buildCrmMetrics(
  opportunities: readonly Opportunity[],
  followUps: readonly FollowUp[],
  series: MetricSeriesMap,
  now: number,
): CrmMetric[] {
  const pipeline = openPipelineValue(opportunities);
  const weighted = weightedForecastValue(opportunities);
  const won = closedWonValue(opportunities);
  const winRate = winRatePercent(opportunities);
  const overdue = overdueFollowUps(followUps, now).length;
  const owners = activeOwnerIds(opportunities).length;

  const previous = (values: readonly number[], fallback: number) =>
    values.length > 1 ? values[values.length - 2]! : fallback;

  return [
    toMetric({
      id: "openPipeline",
      label: "Open pipeline",
      explanation: "Estimated value of active opportunities, excluding won and lost.",
      value: pipeline,
      previousValue: previous(series.openPipeline, pipeline),
      display: formatInr(pipeline, { compact: true }),
      previousDisplay: formatInr(previous(series.openPipeline, pipeline), { compact: true }),
      tone: "info",
      series: series.openPipeline,
    }),
    toMetric({
      id: "weightedForecast",
      label: "Weighted forecast",
      explanation: "Estimated value multiplied by win probability for every active deal.",
      value: weighted,
      previousValue: previous(series.weightedForecast, weighted),
      display: formatInr(weighted, { compact: true }),
      previousDisplay: formatInr(previous(series.weightedForecast, weighted), { compact: true }),
      tone: "success",
      series: series.weightedForecast,
    }),
    toMetric({
      id: "closedWon",
      label: "Closed won",
      explanation: "Total contracted value of opportunities marked won this period.",
      value: won,
      previousValue: previous(series.closedWon, won),
      display: formatInr(won, { compact: true }),
      previousDisplay: formatInr(previous(series.closedWon, won), { compact: true }),
      tone: "success",
      series: series.closedWon,
    }),
    toMetric({
      id: "winRate",
      label: "Win rate",
      explanation: "Won opportunities divided by won plus lost opportunities.",
      value: Math.round(winRate * 10) / 10,
      previousValue: previous(series.winRate, winRate),
      display: formatPercent(winRate),
      previousDisplay: formatPercent(previous(series.winRate, winRate)),
      tone: winRate >= 55 ? "success" : winRate >= 40 ? "warning" : "critical",
      series: series.winRate,
    }),
    toMetric({
      id: "overdueFollowUps",
      label: "Overdue follow-ups",
      explanation: "Incomplete follow-ups whose scheduled time has already passed.",
      value: overdue,
      previousValue: previous(series.overdueFollowUps, overdue),
      display: formatNumber(overdue),
      previousDisplay: formatNumber(previous(series.overdueFollowUps, overdue)),
      tone: overdue > 4 ? "critical" : overdue > 2 ? "warning" : "success",
      series: series.overdueFollowUps,
      invert: true,
    }),
    toMetric({
      id: "activeOwners",
      label: "Active sales owners",
      explanation: "Owners carrying at least one active opportunity.",
      value: owners,
      previousValue: previous(series.activeOwners, owners),
      display: formatNumber(owners),
      previousDisplay: formatNumber(previous(series.activeOwners, owners)),
      tone: "neutral",
      series: series.activeOwners,
    }),
  ];
}

export function buildStageSnapshots(
  opportunities: readonly Opportunity[],
  followUps: readonly FollowUp[],
  now: number,
): CrmStageSnapshot[] {
  const overdueByOpportunity = new Set(
    overdueFollowUps(followUps, now).map((f) => f.opportunityId),
  );

  const counts = new Map<CrmStage, Opportunity[]>();
  for (const stage of CRM_STAGES) counts.set(stage, []);
  for (const row of opportunities) counts.get(row.stage)!.push(row);

  return CRM_STAGES.map((stage, index) => {
    const rows = counts.get(stage)!;
    const previousRows = index > 0 ? counts.get(CRM_STAGES[index - 1]!)! : [];
    const ages = rows.map((row) => ageInDays(row.createdAt, now));
    return {
      stage,
      count: rows.length,
      value: rows.reduce((sum, row) => sum + row.estimatedValue, 0),
      weightedValue: rows.reduce(
        (sum, row) => sum + Math.round((row.estimatedValue * row.probability) / 100),
        0,
      ),
      averageAgeDays:
        ages.length === 0 ? 0 : Math.round(ages.reduce((a, b) => a + b, 0) / ages.length),
      conversionFromPrevious:
        previousRows.length === 0
          ? 100
          : Math.round((rows.length / previousRows.length) * 1000) / 10,
      overdueFollowUps: rows.filter((row) => overdueByOpportunity.has(row.id)).length,
    };
  });
}
