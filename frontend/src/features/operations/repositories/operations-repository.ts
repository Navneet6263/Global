import type { OpsCaseDetail, OpsCaseQuery, OpsClarification } from "../contracts/case";
import type {
  AssignInput,
  AssignmentQueue,
  AssignmentResult,
  CaseActionInput,
  CaseActionResult,
  ClarificationActionInput,
  ClarificationQuery,
  ClarificationResult,
  ExceptionQueue,
  FieldOperations,
  OpsDashboard,
  OpsExceptionQuery,
  OpsFacets,
  OpsNotification,
  PaginatedCases,
  SlaPerformance,
  SlaQuery,
  TeamCapacity,
} from "../contracts/operations";

/**
 * Single data-access contract for the Operations Manager workspace.
 * UI code depends only on this interface — never on a concrete implementation.
 */
export interface OperationsRepository {
  getDashboard(): Promise<OpsDashboard>;
  getFacets(): Promise<OpsFacets>;
  getCases(filters: OpsCaseQuery): Promise<PaginatedCases>;
  getCase(caseId: string): Promise<OpsCaseDetail | null>;
  runCaseAction(input: CaseActionInput): Promise<CaseActionResult>;
  getAssignments(): Promise<AssignmentQueue>;
  assignCase(input: AssignInput): Promise<AssignmentResult>;
  reassignCase(input: AssignInput): Promise<AssignmentResult>;
  getExceptions(filters: OpsExceptionQuery): Promise<ExceptionQueue>;
  resolveException(id: string, note: string): Promise<void>;
  escalateException(id: string, note: string): Promise<void>;
  assignExceptionOwner(id: string, owner: string): Promise<void>;
  getSlaPerformance(filters: SlaQuery): Promise<SlaPerformance>;
  getTeamCapacity(): Promise<TeamCapacity>;
  getFieldOperations(): Promise<FieldOperations>;
  getClarifications(filters: ClarificationQuery): Promise<readonly OpsClarification[]>;
  respondToClarification(input: ClarificationActionInput): Promise<ClarificationResult>;
  getNotifications(): Promise<readonly OpsNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
}
