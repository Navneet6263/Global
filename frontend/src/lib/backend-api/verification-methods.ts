import { apiRequest } from "./client";

export type MethodName = "DIGITAL" | "MANUAL" | "THIRD_PARTY";
export interface MethodRun {
  id: string;
  method: MethodName;
  status: "REQUESTED" | "RESPONDED" | "SUPERSEDED";
  result: string | null;
  provider: string | null;
  sourceContact: string | null;
  reference: string | null;
  requestedAt: string;
  respondedAt: string | null;
  dueAt: string | null;
  nextFollowUpAt?: string | null;
  summary: string | null;
  version: number;
  evidenceIds: string[];
}
export function listVerificationMethods(checkId: string) {
  return apiRequest<{
    items: MethodRun[];
    caseStatus: string;
    evidenceDocuments: MethodEvidenceDocument[];
    digitalMode: "RECORDED_EVIDENCE";
  }>(`/checks/${checkId}/methods`);
}
export interface MethodEvidenceDocument {
  publicId: string;
  type: string;
  status: string;
  currentVersion: number;
}
export function createVerificationMethod(
  checkId: string,
  input: { method: MethodName; provider?: string; sourceContact?: string; dueAt?: string },
) {
  return apiRequest(`/checks/${checkId}/methods`, { method: "POST", body: JSON.stringify(input) });
}
export function respondVerificationMethod(
  checkId: string,
  id: string,
  input: {
    version: number;
    result: string;
    summary: string;
    reference?: string;
    evidenceIds: string[];
    evidenceVersions: Array<{ documentId: string; version: number }>;
  },
) {
  return apiRequest(`/checks/${checkId}/methods/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
