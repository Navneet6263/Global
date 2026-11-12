export const ACTIVE_CLARIFICATION_STATUSES = [
  "OPEN",
  "RESPONDED",
  "CANDIDATE_SUBMITTED",
  "DATA_ENTRY_PENDING",
] as const;

export const OPS_REVIEWABLE_CLARIFICATION_STATUSES = [
  "RESPONDED",
  "CANDIDATE_SUBMITTED",
] as const;

export const L2_ACTIVE_CLARIFICATION_STATUSES = [
  "OPEN",
  "CANDIDATE_SUBMITTED",
  "DATA_ENTRY_PENDING",
] as const;

export const CLARIFICATION_LEVELS = ["L1", "L2"] as const;

export const DOCUMENT_VERSION_REVIEW_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "REUPLOAD_REQUIRED",
  "SUPERSEDED",
] as const;

export type ClarificationStatus =
  | (typeof ACTIVE_CLARIFICATION_STATUSES)[number]
  | "RESOLVED";

export type ClarificationLevel = (typeof CLARIFICATION_LEVELS)[number];

export type DocumentVersionReviewStatus =
  (typeof DOCUMENT_VERSION_REVIEW_STATUSES)[number];
