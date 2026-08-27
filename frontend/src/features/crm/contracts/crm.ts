import type { Paginated, StatusTone, TrendDirection } from "@/lib/contracts/common";

export type CrmStage = "NEW" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

export type LeadSource = "INBOUND" | "OUTBOUND" | "REFERRAL" | "EVENT" | "PARTNER" | "MARKETPLACE";

export type SalesActivityType =
  "CALL" | "EMAIL" | "MEETING" | "NOTE" | "FOLLOW_UP" | "STAGE_CHANGE" | "CREATED" | "WON" | "LOST";

export type FollowUpPriority = "high" | "medium" | "low";

export interface Opportunity {
  id: string;
  accountId: string;
  company: string;
  city: string;
  industry: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactMobile: string;
  stage: CrmStage;
  source: LeadSource;
  estimatedValue: number;
  probability: number;
  weightedValue: number;
  ownerId: string | null;
  ownerName: string | null;
  expectedCloseDate: string;
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  notes: string;
  lostReason?: string;
  competitor?: string;
  closedAt?: string;
  finalValue?: number;
  onboardingHandoff?: boolean;
}

export interface OpportunityDetail extends Opportunity {
  ageDays: number;
  activities: readonly SalesActivity[];
}

export interface SalesActivity {
  id: string;
  opportunityId: string;
  company: string;
  contactName: string;
  actor: string;
  type: SalesActivityType;
  summary: string;
  occurredAt: string;
  notes?: string;
}

export interface FollowUp {
  id: string;
  opportunityId: string;
  company: string;
  contactName: string;
  ownerName: string | null;
  stage: CrmStage;
  estimatedValue: number;
  dueAt: string;
  completedAt: string | null;
  priority: FollowUpPriority;
  notes: string;
  lastActivityAt: string | null;
  suggestedAction: string;
}

export interface SalesAccount {
  id: string;
  company: string;
  status: "prospect" | "active" | "dormant" | "churn-risk";
  industry: string;
  city: string;
  openOpportunities: number;
  pipelineValue: number;
  wonRevenue: number;
  primaryContact: string;
  contactEmail: string;
  contactMobile: string;
  ownerName: string | null;
  lastActivityAt: string | null;
  nextFollowUpAt: string | null;
}

export interface SalesOwner {
  id: string;
  name: string;
  email: string;
  territory: string;
  activeOpportunities: number;
  pipelineValue: number;
  weightedForecast: number;
  wonRevenue: number;
  winRate: number;
  overdueFollowUps: number;
  activitiesThisWeek: number;
  closingThisMonth: number;
}

export type CrmMetricId =
  | "openPipeline"
  | "weightedForecast"
  | "closedWon"
  | "winRate"
  | "overdueFollowUps"
  | "activeOwners";

export interface CrmMetric {
  id: CrmMetricId;
  label: string;
  explanation: string;
  value: number;
  display: string;
  previousValue: number;
  previousDisplay: string;
  deltaPercent: number;
  direction: TrendDirection;
  tone: StatusTone;
  series: readonly number[];
}

export interface CrmStageSnapshot {
  stage: CrmStage;
  count: number;
  value: number;
  weightedValue: number;
  averageAgeDays: number;
  conversionFromPrevious: number;
  overdueFollowUps: number;
}

export interface CrmTrendPoint {
  label: string;
  pipeline: number;
  weighted: number;
  won: number;
}

export interface CrmOverview {
  generatedAt: string;
  metrics: readonly CrmMetric[];
  stages: readonly CrmStageSnapshot[];
  trend: readonly CrmTrendPoint[];
  activities: readonly SalesActivity[];
  followUps: readonly FollowUp[];
}

export interface CrmAdminSummary {
  generatedAt: string;
  metrics: readonly CrmMetric[];
  trend: readonly CrmTrendPoint[];
  pendingFollowUps: number;
  overdueFollowUps: number;
  unassignedOpportunities: number;
}

export interface OpportunityQuery {
  search?: string;
  stage?: CrmStage | "all";
  owner?: string | "all" | "unassigned";
  source?: LeadSource | "all";
  minValue?: number;
  maxValue?: number;
  minProbability?: number;
  maxProbability?: number;
  closeFrom?: string;
  closeTo?: string;
  followUp?: "all" | "overdue" | "today" | "upcoming" | "none";
  savedView?: string;
  sort?: "value" | "probability" | "close" | "recent";
  page?: number;
  pageSize?: number;
}

export interface ActivityQuery {
  search?: string;
  type?: SalesActivityType | "all";
  owner?: string | "all";
  company?: string | "all";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type FollowUpView =
  "overdue" | "today" | "tomorrow" | "week" | "upcoming" | "completed" | "none";

export interface FollowUpQuery {
  view?: FollowUpView;
  owner?: string | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AccountQuery {
  search?: string;
  status?: SalesAccount["status"] | "all";
  owner?: string | "all";
  page?: number;
  pageSize?: number;
}

export interface ForecastQuery {
  period?: "month" | "quarter" | "year";
  owner?: string | "all";
  stage?: CrmStage | "all";
  source?: LeadSource | "all";
  minValue?: number;
}

export interface ForecastBucket {
  label: string;
  value: number;
  weighted: number;
}

export interface RevenueForecast {
  period: "month" | "quarter" | "year";
  openPipeline: number;
  weightedForecast: number;
  commitForecast: number;
  bestCaseForecast: number;
  closedWon: number;
  target: number;
  gapToTarget: number;
  monthly: readonly CrmTrendPoint[];
  byOwner: readonly ForecastBucket[];
  byStage: readonly ForecastBucket[];
  calendar: readonly { date: string; count: number; value: number }[];
  atRisk: readonly Opportunity[];
}

export interface CreateOpportunityInput {
  company: string;
  city?: string;
  industry?: string;
  contactName: string;
  contactTitle?: string;
  contactEmail: string;
  contactMobile: string;
  source: LeadSource;
  estimatedValue: number;
  probability: number;
  expectedCloseDate: string;
  ownerId: string | null;
  nextFollowUpAt: string | null;
  notes?: string;
}

export type UpdateOpportunityInput = Partial<CreateOpportunityInput>;

export interface StageChangeInput {
  opportunityId: string;
  stage: CrmStage;
  lostReason?: string;
  competitor?: string;
  finalValue?: number;
  notes?: string;
}

export interface AddActivityInput {
  opportunityId: string;
  type: SalesActivityType;
  summary: string;
  occurredAt: string;
  nextFollowUpAt?: string | null;
  notes?: string;
}

export interface FollowUpActionInput {
  followUpId: string;
  dueAt?: string;
  notes?: string;
  nextFollowUpAt?: string | null;
}

export interface AssignOwnerInput {
  opportunityId: string;
  ownerId: string | null;
}

export type PaginatedOpportunities = Paginated<Opportunity>;
export type PaginatedActivities = Paginated<SalesActivity>;
export type PaginatedFollowUps = Paginated<FollowUp>;
export type PaginatedAccounts = Paginated<SalesAccount>;
