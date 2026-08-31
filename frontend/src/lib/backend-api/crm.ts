import { apiRequest } from "./client";
import { toIndianMobileE164 } from "@/lib/indian-mobile";

export const opportunityStages = [
  "NEW",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export type OpportunityStage = (typeof opportunityStages)[number];

export type CrmLeadSource =
  "INBOUND" | "OUTBOUND" | "REFERRAL" | "EVENT" | "PARTNER" | "MARKETPLACE";

export interface CrmSettingsResponse {
  id: string | null;
  stageProbabilities: Record<OpportunityStage, number>;
  leadSources: CrmLeadSource[];
  version: number;
  updatedAt: string | null;
  canEdit: boolean;
}

export interface Opportunity {
  id: string;
  companyName: string;
  city?: string | null;
  industry?: string | null;
  contactName: string;
  contactTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  stage: OpportunityStage;
  source?: string | null;
  estimatedValue: string | number;
  probability: number;
  expectedCloseDate?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  lostReason?: string | null;
  closedAt?: string | null;
  onboardingHandoffAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  owner?: { publicId: string; displayName: string; email: string } | null;
  client?: { publicId: string; displayName: string } | null;
}

export interface SalesActivity {
  id: string;
  type: string;
  summary: string;
  occurredAt: string;
  actor: { displayName: string };
}

export interface SalesActivityListItem extends SalesActivity {
  opportunity: { id: string; companyName: string; contactName: string };
}

export type OpportunityDetail = Opportunity & { activities: SalesActivity[] };

export interface SalesOwner {
  id: string;
  displayName: string;
  email: string;
  branch?: { name: string } | null;
  activeOpportunities: number;
  pipelineValue: number;
  weightedForecast: number;
  wonRevenue: number;
  winRate: number;
  overdueFollowUps: number;
  activitiesThisWeek: number;
  closingThisMonth: number;
}

export interface CrmOverview {
  summary: {
    openCount: number;
    openValue: number;
    weightedValue: number;
    wonValue: number;
    activeOwners: number;
    wonCount: number;
    lostCount: number;
    winRate: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
    unassignedOpportunities: number;
  };
  stages: Array<{
    stage: string;
    count: number;
    value: number;
    weightedValue: number;
    averageAgeDays: number | null;
    conversionFromPrevious: number | null;
    overdueFollowUps: number;
  }>;
  trend: Array<{
    month: string;
    pipelineValue: number;
    weightedValue: number;
    wonValue: number;
    winRate: number;
    activeOwners: number;
  }>;
  activities: Array<{
    id: string;
    type: string;
    summary: string;
    occurredAt: string;
    actor: { displayName: string };
    opportunity: { publicId: string; companyName: string; contactName: string };
  }>;
  followUps: Array<{
    opportunityId: string;
    companyName: string;
    contactName: string;
    ownerName: string | null;
    stage: OpportunityStage;
    estimatedValue: number;
    dueAt: string;
    notes: string | null;
    lastActivityAt: string;
  }>;
  generatedAt: string;
}

export function getCrmOverview() {
  return apiRequest<CrmOverview>("/crm/overview");
}
export function listOpportunities(input: OpportunityListInput = {}) {
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && key !== "limit") query.set(key, String(value));
  });
  query.set("limit", String(input.limit ?? 25));
  return apiRequest<OpportunityListResponse>(`/crm/opportunities?${query.toString()}`);
}

export function getOpportunity(id: string) {
  return apiRequest<OpportunityDetail>(`/crm/opportunities/${id}`);
}

export function listSalesOwners() {
  return apiRequest<{ items: SalesOwner[] }>("/crm/owners");
}

export function getCrmSettings() {
  return apiRequest<CrmSettingsResponse>("/crm/settings");
}

export function updateCrmSettings(input: {
  version: number;
  stageProbabilities: Record<OpportunityStage, number>;
  leadSources: CrmLeadSource[];
}) {
  return apiRequest<CrmSettingsResponse>("/crm/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function listSalesActivities(input: {
  search?: string;
  type?: string;
  owner?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  return apiRequest<{
    items: SalesActivityListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/crm/activities?${query.toString()}`);
}
export function createOpportunity(input: {
  companyName: string;
  city?: string;
  industry?: string;
  contactName: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  ownerId?: string;
  source?: string;
  estimatedValue: number;
  probability: number;
  expectedCloseDate: string;
  nextFollowUpAt?: string;
  notes?: string;
}) {
  const contactPhone = toIndianMobileE164(input.contactPhone);
  return apiRequest<Opportunity>("/crm/opportunities", {
    method: "POST",
    body: JSON.stringify({ ...input, contactPhone }),
  });
}
export function updateOpportunity(
  id: string,
  input: {
    version: number;
    stage?: OpportunityStage;
    probability?: number;
    ownerId?: string | null;
    estimatedValue?: number;
    expectedCloseDate?: string;
    nextFollowUpAt?: string;
    notes?: string | null;
    lostReason?: string;
    companyName?: string;
    city?: string | null;
    industry?: string | null;
    contactName?: string;
    contactTitle?: string | null;
    contactEmail?: string;
    contactPhone?: string;
    source?: string;
    activitySummary?: string;
  },
) {
  const contactPhone = toIndianMobileE164(input.contactPhone);
  return apiRequest<Opportunity>(`/crm/opportunities/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, contactPhone }),
  });
}

export function addSalesActivity(
  id: string,
  input: {
    type: "CALL" | "EMAIL" | "MEETING" | "NOTE" | "FOLLOW_UP";
    summary: string;
    occurredAt?: string;
    nextFollowUpAt?: string;
  },
) {
  return apiRequest<SalesActivity>(`/crm/opportunities/${id}/activities`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function completeSalesFollowUp(id: string, input: { version: number; notes?: string }) {
  return apiRequest<{
    opportunityId: string;
    completedAt: string;
    version: number;
  }>(`/crm/opportunities/${id}/follow-up/complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function prepareSalesOnboarding(id: string, version: number) {
  return apiRequest<{ opportunityId: string; preparedAt: string; version: number }>(
    `/crm/opportunities/${id}/onboarding-handoff`,
    { method: "POST", body: JSON.stringify({ version }) },
  );
}

interface OpportunityListInput {
  stage?: string;
  search?: string;
  cursor?: string;
  limit?: number;
  page?: number;
  owner?: string;
  source?: string;
  minValue?: number;
  maxValue?: number;
  minProbability?: number;
  maxProbability?: number;
  closeFrom?: string;
  closeTo?: string;
  followUp?: string;
  sort?: string;
  savedView?: string;
}

interface OpportunityListResponse {
  items: Opportunity[];
  nextCursor: string | null;
  total: number;
  page: number;
  pageSize: number;
}
