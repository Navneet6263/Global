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

export interface Opportunity {
  id: string;
  companyName: string;
  contactName: string;
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

export type OpportunityDetail = Opportunity & { activities: SalesActivity[] };

export interface SalesOwner {
  id: string;
  displayName: string;
  email: string;
}

export interface CrmOverview {
  summary: {
    openCount: number;
    openValue: number;
    weightedValue: number;
    wonValue: number;
    activeOwners: number;
  };
  stages: Array<{ stage: string; count: number; value: number }>;
  trend: Array<{
    month: string;
    pipelineValue: number;
    weightedValue: number;
    wonValue: number;
    activeOwners: number;
  }>;
  activities: Array<{
    id: string;
    type: string;
    summary: string;
    occurredAt: string;
    actor: { displayName: string };
    opportunity: { publicId: string; companyName: string };
  }>;
  generatedAt: string;
}

export function getCrmOverview() {
  return apiRequest<CrmOverview>("/crm/overview");
}
export function listOpportunities(
  input: { stage?: string; search?: string; cursor?: string; limit?: number } = {},
) {
  const query = new URLSearchParams();
  if (input.stage) query.set("stage", input.stage);
  if (input.search) query.set("search", input.search);
  if (input.cursor) query.set("cursor", input.cursor);
  query.set("limit", String(input.limit ?? 25));
  return apiRequest<{ items: Opportunity[]; nextCursor: string | null }>(
    `/crm/opportunities?${query.toString()}`,
  );
}

export function getOpportunity(id: string) {
  return apiRequest<OpportunityDetail>(`/crm/opportunities/${id}`);
}

export function listSalesOwners() {
  return apiRequest<{ items: SalesOwner[] }>("/crm/owners");
}
export function createOpportunity(input: {
  companyName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  ownerId?: string;
  source?: string;
  estimatedValue: number;
  probability: number;
  expectedCloseDate?: string;
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
    ownerId?: string;
    estimatedValue?: number;
    expectedCloseDate?: string;
    nextFollowUpAt?: string;
    notes?: string;
    lostReason?: string;
    companyName?: string;
    contactName?: string;
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
