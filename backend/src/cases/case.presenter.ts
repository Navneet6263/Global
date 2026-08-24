import type { SubjectPiiService } from "../common/security/subject-pii.service";

export function presentCaseListItem(row: any, pii?: SubjectPiiService) {
  return {
    id: row.publicId,
    caseNumber: row.caseNumber,
    externalRef: row.externalRef,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt,
    completedAt: row.completedAt,
    riskLevel: row.riskLevel,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    subject: pii ? pii.present(row.subject) : row.subject,
    client: row.client,
    checks: row.checks,
  };
}

export function presentCaseDetail(row: any, pii?: SubjectPiiService) {
  return {
    ...presentCaseListItem(row, pii),
    statusHistory: row.statusHistory,
    consents: row.consents,
    documents: row.documents,
    clarifications: row.clarifications,
    qaReviews: row.qaReviews,
    reports: row.reports,
    fieldVisits: row.fieldVisits,
  };
}
