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
  OpportunityQuery,
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
    city: "—",
    industry: "—",
    contactName: row.contactName,
    contactTitle: "",
    contactEmail: row.contactEmail ?? "",
    contactMobile: row.contactPhone ?? "",
    stage: row.stage,
    source: sourceOf(row.source),
    estimatedValue,
    probability: row.probability,
    weightedValue: Math.round((estimatedValue * row.probability) / 100),
    ownerId: row.owner?.publicId ?? null,
    ownerName: row.owner?.displayName ?? null,
    expectedCloseDate: row.expectedCloseDate ?? row.updatedAt,
    nextFollowUpAt: row.nextFollowUpAt ?? null,
    lastActivityAt: row.updatedAt,
    createdAt: row.createdAt,
    notes: row.notes ?? "",
    lostReason: row.lostReason ?? undefined,
    closedAt: row.closedAt ?? undefined,
    finalValue: row.stage === "WON" ? estimatedValue : undefined,
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
  return {
    id,
    label,
    explanation,
    value,
    display,
    previousValue: value,
    previousDisplay: display,
    deltaPercent: 0,
    direction: "flat",
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
  const response = await listOpportunities({ limit: 100 });
  return response.items.map(mapOpportunity);
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

export function filterOpportunities(rows: Opportunity[], query: OpportunityQuery): Opportunity[] {
  const search = query.search?.toLowerCase();
  return rows.filter((row) => {
    if (search && !`${row.company} ${row.contactName} ${row.city}`.toLowerCase().includes(search))
      return false;
    if (query.stage && query.stage !== "all" && row.stage !== query.stage) return false;
    if (query.owner === "unassigned" && row.ownerId) return false;
    if (query.owner && !["all", "unassigned"].includes(query.owner) && row.ownerId !== query.owner)
      return false;
    if (query.source && query.source !== "all" && row.source !== query.source) return false;
    if (query.minValue !== undefined && row.estimatedValue < query.minValue) return false;
    if (query.maxValue !== undefined && row.estimatedValue > query.maxValue) return false;
    if (query.minProbability !== undefined && row.probability < query.minProbability) return false;
    if (query.maxProbability !== undefined && row.probability > query.maxProbability) return false;
    if (query.followUp === "none" && row.nextFollowUpAt) return false;
    if (
      query.followUp === "overdue" &&
      (!row.nextFollowUpAt || Date.parse(row.nextFollowUpAt) >= Date.now())
    )
      return false;
    return true;
  });
}

export async function overview(): Promise<CrmOverview> {
  const data = await getCrmOverview();
  const values = data.trend.map((row) => row.pipelineValue);
  const weighted = data.trend.map((row) => row.weightedValue);
  const won = data.trend.map((row) => row.wonValue);
  const opportunities = await allOpportunities();
  const followUps = opportunities.map(followUpFrom).filter((row): row is FollowUp => row !== null);
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
        "Revenue won in the selected period",
        data.summary.wonValue,
        money(data.summary.wonValue),
        "success",
        won,
      ),
      metric(
        "winRate",
        "Win rate",
        "Won opportunities against closed deals",
        0,
        "0%",
        "success",
        data.trend.map(() => 0),
      ),
      metric(
        "overdueFollowUps",
        "Overdue follow-ups",
        "Prospect actions past their due time",
        followUps.filter((row) => Date.parse(row.dueAt) < Date.now()).length,
        String(followUps.filter((row) => Date.parse(row.dueAt) < Date.now()).length),
        "warning",
        data.trend.map(() => 0),
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
      weightedValue: Math.round(
        (row.value *
          ((
            { NEW: 10, QUALIFIED: 30, PROPOSAL: 50, NEGOTIATION: 75, WON: 100, LOST: 0 } as Record<
              string,
              number
            >
          )[row.stage] ?? 0)) /
          100,
      ),
      averageAgeDays: 0,
      conversionFromPrevious: 0,
      overdueFollowUps: opportunities.filter(
        (item) =>
          item.stage === row.stage &&
          item.nextFollowUpAt &&
          Date.parse(item.nextFollowUpAt) < Date.now(),
      ).length,
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
      contactName: "",
      actor: row.actor.displayName,
      type: activityType(row.type),
      summary: row.summary,
      occurredAt: row.occurredAt,
    })),
    followUps,
  };
}
