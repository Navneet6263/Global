import type { CaseStage } from "@/lib/contracts/case";

export const dashboardStageMap: Record<string, CaseStage> = {
  DRAFT: "intake",
  CONSENT_PENDING: "consent",
  DOCUMENT_PENDING: "documents",
  IN_PROGRESS: "verification",
  CLARIFICATION_PENDING: "clarification",
  QA_REVIEW: "qa",
  MANAGER_REVIEW: "manager_review",
  REPORT_PENDING: "report_pending",
  PAYMENT_PENDING: "payment_pending",
  COMPLETED: "completed",
  CLOSED: "completed",
  CANCELLED: "completed",
};
