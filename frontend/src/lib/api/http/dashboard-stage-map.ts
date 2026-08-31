import type { CaseStage } from "@/lib/contracts/case";

export const dashboardStageMap: Record<string, CaseStage> = {
  DRAFT: "intake",
  CONSENT_PENDING: "consent",
  DOCUMENT_PENDING: "documents",
  IN_PROGRESS: "verification",
  CLARIFICATION_PENDING: "clarification",
  QA_REVIEW: "qa",
  COMPLETED: "completed",
  CLOSED: "completed",
  CANCELLED: "completed",
};
