import { apiRequest } from "./client";

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
  notes?: string | null;
  closedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  owner?: { publicId: string; displayName: string; email: string } | null;
  client?: { publicId: string; displayName: string } | null;
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
export function listOpportunities(input: { stage?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (input.stage) query.set("stage", input.stage);
  if (input.search) query.set("search", input.search);
  return apiRequest<{ items: Opportunity[] }>(`/crm/opportunities?${query.toString()}`);
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
  notes?: string;
}) {
  return apiRequest<Opportunity>("/crm/opportunities", {
    method: "POST",
    body: JSON.stringify(input),
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
    notes?: string;
    activitySummary?: string;
  },
) {
  return apiRequest<Opportunity>(`/crm/opportunities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
