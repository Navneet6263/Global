import { apiRequest } from "./client";

export interface BulkAssignDataEntryInput {
  assigneeId: string;
  note?: string;
  items: Array<{ caseId: string; version: number }>;
}

export interface BulkAssignSuccessItem {
  caseId: string;
  caseNumber: string;
  intakeStage: string;
  version: number;
}

export interface BulkAssignFailureItem {
  caseId: string;
  caseNumber?: string;
  code: string;
  reason: string;
}

export interface BulkAssignDataEntryResult {
  assignedCount: number;
  failedCount: number;
  assignee: { id: string; name: string };
  assigned: BulkAssignSuccessItem[];
  failed: BulkAssignFailureItem[];
}

export const bulkAssignDataEntry = (input: BulkAssignDataEntryInput) =>
  apiRequest<BulkAssignDataEntryResult>("/workflow/cases/bulk-data-entry", {
    method: "POST",
    body: JSON.stringify(input),
  });
