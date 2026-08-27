import type {
  AccountQuery,
  ActivityQuery,
  AddActivityInput,
  AssignOwnerInput,
  CreateOpportunityInput,
  CrmAdminSummary,
  CrmOverview,
  FollowUp,
  FollowUpActionInput,
  FollowUpQuery,
  ForecastQuery,
  Opportunity,
  OpportunityDetail,
  OpportunityQuery,
  PaginatedAccounts,
  PaginatedActivities,
  PaginatedFollowUps,
  PaginatedOpportunities,
  RevenueForecast,
  SalesActivity,
  SalesOwner,
  StageChangeInput,
  UpdateOpportunityInput,
} from "../contracts/crm";

/** Single data contract for the Sales & CRM workspace. */
export interface CrmRepository {
  getOverview(): Promise<CrmOverview>;
  getAdminSummary(): Promise<CrmAdminSummary>;
  getOpportunities(filters: OpportunityQuery): Promise<PaginatedOpportunities>;
  getOpportunity(opportunityId: string): Promise<OpportunityDetail>;
  createOpportunity(input: CreateOpportunityInput): Promise<Opportunity>;
  updateOpportunity(opportunityId: string, input: UpdateOpportunityInput): Promise<Opportunity>;
  changeOpportunityStage(input: StageChangeInput): Promise<Opportunity>;
  assignOwner(input: AssignOwnerInput): Promise<Opportunity>;
  prepareOnboarding(opportunityId: string): Promise<Opportunity>;
  addActivity(input: AddActivityInput): Promise<SalesActivity>;
  getActivities(filters: ActivityQuery): Promise<PaginatedActivities>;
  getFollowUps(filters: FollowUpQuery): Promise<PaginatedFollowUps>;
  completeFollowUp(input: FollowUpActionInput): Promise<FollowUp>;
  rescheduleFollowUp(input: FollowUpActionInput): Promise<FollowUp>;
  getAccounts(filters: AccountQuery): Promise<PaginatedAccounts>;
  getForecast(filters: ForecastQuery): Promise<RevenueForecast>;
  getSalesOwners(): Promise<SalesOwner[]>;
}
