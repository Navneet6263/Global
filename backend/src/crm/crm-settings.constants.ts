export const CRM_STAGES = [
  "NEW",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_LEAD_SOURCES = [
  "INBOUND",
  "OUTBOUND",
  "REFERRAL",
  "EVENT",
  "PARTNER",
  "MARKETPLACE",
] as const;

export type CrmLeadSource = (typeof CRM_LEAD_SOURCES)[number];

export type CrmStageProbabilities = Record<CrmStage, number>;

export const DEFAULT_CRM_STAGE_PROBABILITIES: CrmStageProbabilities = {
  NEW: 10,
  QUALIFIED: 30,
  PROPOSAL: 55,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};
