import type {
  Opportunity as BackendOpportunity,
  OpportunityDetail as BackendOpportunityDetail,
} from "@/lib/backend-api/crm";
import { getCrmOverview, listOpportunities } from "@/lib/backend-api/crm";
import type {
  CrmMetric,
  CrmOverview,
  CrmStage,
  FollowUp,
  LeadSource,
  Opportunity,
  SalesActivity,
  SalesActivityType,
} from "../contracts/crm";

export const versions = new Map<string, number>();

export function sourceOf(value?: string | null): LeadSource {
  const source = value?.toUpperCase();
  return ["INBOUND", "OUTBOUND", "REFERRAL", "EVENT", "PARTNER", "MARKETPLACE"].includes(
    source ?? "",
  )
    ? (source as LeadSource)
    : "INBOUND";
}

export function activityType(value: string): SalesActivityType {
  const normalized = value === "STAGE_CHANGED" ? "STAGE_CHANGE" : value;
  return [
    "CALL",
    "EMAIL",
    "MEETING",
    "NOTE",
    "FOLLOW_UP",
    "STAGE_CHANGE",
    "CREATED",
    "WON",
    "LOST",
  ].includes(normalized)
    ? (normalized as SalesActivityType)
    : "NOTE";
}

export function mapOpportunity(row: BackendOpportunity): Opportunity {
  versions.set(row.id, row.version);
  const estimatedValue = Number(row.estimatedValue);
  return {
    id: row.id,
    accountId: row.client?.publicId ?? row.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    company: row.companyName,
    city: row.city ?? "",
    industry: row.industry ?? "",
    contactName: row.contactName,
    contactTitle: row.contactTitle ?? "",
    contactEmail: row.contactEmail ?? "",
    contactMobile: row.contactPhone ?? "",
    stage: row.stage,
    source: sourceOf(row.source),
    estimatedValue,
    probability: row.probability,
    weightedValue: Math.round((estimatedValue * row.probability) / 100),
    ownerId: row.owner?.publicId ?? null,
    ownerName: row.owner?.displayName ?? null,
    expectedCloseDate: row.expectedCloseDate ?? null,
    nextFollowUpAt: row.nextFollowUpAt ?? null,
    lastActivityAt: row.updatedAt,
    createdAt: row.createdAt,
    notes: row.notes ?? "",
    lostReason: row.lostReason ?? undefined,
    closedAt: row.closedAt ?? undefined,
    finalValue: row.stage === "WON" ? estimatedValue : undefined,
    onboardingHandoff: Boolean(row.onboardingHandoffAt),
    onboardingHandoffAt: row.onboardingHandoffAt ?? null,
  };
}

export function mapActivity(
  row: BackendOpportunityDetail["activities"][number],
  opportunity: BackendOpportunity,
): SalesActivity {
  return {
    id: row.id,
    opportunityId: opportunity.id,
    company: opportunity.companyName,
    contactName: opportunity.contactName,
    actor: row.actor.displayName,
    type: activityType(row.type),
    summary: row.summary,
    occurredAt: row.occurredAt,
  };
}

export function metric(
  id: CrmMetric["id"],
  label: string,
  explanation: string,
  value: number,
  display: string,
  tone: CrmMetric["tone"],
  series: number[],
): CrmMetric {
  const previousValue = series.at(-2) ?? value;
  const currentPoint = series.at(-1) ?? value;
  const deltaPercent =
    previousValue === 0
      ? currentPoint === 0
        ? 0
        : 100
      : ((currentPoint - previousValue) / Math.abs(previousValue)) * 100;
  return {
    id,
    label,
    explanation,
    value,
    display,
    previousValue,
    previousDisplay: metricDisplay(id, previousValue),
    deltaPercent,
    direction: deltaPercent > 0 ? "up" : deltaPercent < 0 ? "down" : "flat",
    tone,
    series,
  };
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function allOpportunities(): Promise<Opportunity[]> {
  const rows: Opportunity[] = [];
  let cursor: string | undefined;
  do {
    const response = await listOpportunities({ limit: 100, cursor });
    rows.push(...response.items.map(mapOpportunity));
    cursor = response.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}

function metricDisplay(id: CrmMetric["id"], value: number) {
  if (id === "winRate") return `${value.toFixed(1)}%`;
  if (id === "overdueFollowUps" || id === "activeOwners") {
    return new Intl.NumberFormat("en-IN").format(value);
  }
  return money(value);
}

export function followUpFrom(row: Opportunity): FollowUp | null {
  if (!row.nextFollowUpAt) return null;
  const hours = (Date.parse(row.nextFollowUpAt) - Date.now()) / 3_600_000;
  return {
    id: row.id,
    opportunityId: row.id,
    company: row.company,
    contactName: row.contactName,
    ownerName: row.ownerName,
    stage: row.stage,
    estimatedValue: row.estimatedValue,
    dueAt: row.nextFollowUpAt,
    completedAt: null,
    priority: hours < 0 ? "high" : hours < 48 ? "medium" : "low",
    notes: row.notes,
    lastActivityAt: row.lastActivityAt,
    suggestedAction: hours < 0 ? "Complete overdue follow-up" : "Contact prospect",
  };
}

export function paginate<T>(rows: T[], page = 1, pageSize = 10) {
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

export async function overview(): Promise<CrmOverview> {
  const data = await getCrmOverview();
  const values = data.trend.map((row) => row.pipelineValue);
  const weighted = data.trend.map((row) => row.weightedValue);
  const won = data.trend.map((row) => row.wonValue);
  const followUps = data.followUps.map((row): FollowUp => {
    const hours = (Date.parse(row.dueAt) - Date.now()) / 3_600_000;
    return {
      id: row.opportunityId,
      opportunityId: row.opportunityId,
      company: row.companyName,
      contactName: row.contactName,
      ownerName: row.ownerName,
      stage: row.stage,
      estimatedValue: row.estimatedValue,
      dueAt: row.dueAt,
      completedAt: null,
      priority: hours < 0 ? "high" : hours < 48 ? "medium" : "low",
      notes: row.notes ?? "",
      lastActivityAt: row.lastActivityAt,
      suggestedAction: hours < 0 ? "Complete overdue follow-up" : "Contact prospect",
    };
  });
  return {
    generatedAt: data.generatedAt,
    metrics: [
      metric(
        "openPipeline",
        "Open pipeline",
        "Value across active opportunities",
        data.summary.openValue,
        money(data.summary.openValue),
        "info",
        values,
      ),
      metric(
        "weightedForecast",
        "Weighted forecast",
        "Probability-adjusted pipeline",
        data.summary.weightedValue,
        money(data.summary.weightedValue),
        "review",
        weighted,
      ),
      metric(
        "closedWon",
        "Closed won",
        "All-time recorded won revenue",
        data.summary.wonValue,
        money(data.summary.wonValue),
        "success",
        won,
      ),
      metric(
        "winRate",
        "Win rate",
        "Won opportunities against closed deals",
        data.summary.winRate,
        `${data.summary.winRate.toFixed(1)}%`,
        "success",
        data.trend.map((row) => row.winRate),
      ),
      metric(
        "overdueFollowUps",
        "Overdue follow-ups",
        "Prospect actions past their due time",
        data.summary.overdueFollowUps,
        String(data.summary.overdueFollowUps),
        "warning",
        [data.summary.overdueFollowUps],
      ),
      metric(
        "activeOwners",
        "Active owners",
        "Sales owners carrying pipeline",
        data.summary.activeOwners,
        String(data.summary.activeOwners),
        "neutral",
        data.trend.map((row) => row.activeOwners),
      ),
    ],
    stages: data.stages.map((row) => ({
      stage: row.stage as CrmStage,
      count: row.count,
      value: row.value,
      weightedValue: row.weightedValue,
      averageAgeDays: row.averageAgeDays,
      conversionFromPrevious: row.conversionFromPrevious,
      overdueFollowUps: row.overdueFollowUps,
    })),
    trend: data.trend.map((row) => ({
      label: row.month,
      pipeline: row.pipelineValue,
      weighted: row.weightedValue,
      won: row.wonValue,
    })),
    activities: data.activities.map((row) => ({
      id: row.id,
      opportunityId: row.opportunity.publicId,
      company: row.opportunity.companyName,
      contactName: row.opportunity.contactName,
      actor: row.actor.displayName,
      type: activityType(row.type),
      summary: row.summary,
      occurredAt: row.occurredAt,
    })),
    followUps,
    pendingFollowUpsTotal: data.summary.pendingFollowUps,
    overdueFollowUpsTotal: data.summary.overdueFollowUps,
    unassignedOpportunitiesTotal: data.summary.unassignedOpportunities,
  };
}
