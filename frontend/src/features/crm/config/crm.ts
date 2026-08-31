import type { CrmStage, FollowUpView, LeadSource, SalesActivityType } from "../contracts/crm";
import type { StatusTone } from "@/lib/contracts/common";

export const CRM_STAGES: readonly CrmStage[] = [
  "NEW",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

/** Stages that still count as active pipeline. */
export const ACTIVE_STAGES: readonly CrmStage[] = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION"];

export const STAGE_LABEL: Record<CrmStage, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const STAGE_TONE: Record<CrmStage, StatusTone> = {
  NEW: "neutral",
  QUALIFIED: "info",
  PROPOSAL: "review",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "critical",
};

/** Default probability applied when an opportunity moves into a stage. */
export const STAGE_DEFAULT_PROBABILITY: Record<CrmStage, number> = {
  NEW: 10,
  QUALIFIED: 30,
  PROPOSAL: 55,
  NEGOTIATION: 75,
  WON: 100,
  LOST: 0,
};

export const LEAD_SOURCES: readonly LeadSource[] = [
  "INBOUND",
  "OUTBOUND",
  "REFERRAL",
  "EVENT",
  "PARTNER",
  "MARKETPLACE",
];

export const SOURCE_LABEL: Record<LeadSource, string> = {
  INBOUND: "Inbound enquiry",
  OUTBOUND: "Outbound prospecting",
  REFERRAL: "Client referral",
  EVENT: "Event / conference",
  PARTNER: "Channel partner",
  MARKETPLACE: "Marketplace listing",
};

export const ACTIVITY_TYPES: readonly SalesActivityType[] = [
  "CALL",
  "EMAIL",
  "MEETING",
  "NOTE",
  "FOLLOW_UP",
  "STAGE_CHANGE",
  "CREATED",
  "WON",
  "LOST",
];

export const ACTIVITY_LABEL: Record<SalesActivityType, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  NOTE: "Note",
  FOLLOW_UP: "Follow-up",
  STAGE_CHANGE: "Stage change",
  CREATED: "Created",
  WON: "Won",
  LOST: "Lost",
};

export const LOST_REASONS: readonly string[] = [
  "Price higher than competitor",
  "Chose incumbent vendor",
  "Budget deferred",
  "TAT expectations not met",
  "No compliance mandate yet",
  "Lost to in-house team",
];

export const FOLLOW_UP_VIEWS: readonly { id: FollowUpView; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed activity" },
  { id: "none", label: "No next action" },
];

export const SAVED_VIEWS: readonly { id: string; label: string; description: string }[] = [
  { id: "all", label: "All opportunities", description: "Everything in the pipeline" },
  { id: "mine", label: "My opportunities", description: "Owned by the signed-in manager" },
  { id: "unassigned", label: "Unassigned", description: "No sales owner allocated" },
  { id: "high-value", label: "High value", description: "Above ₹15,00,000 estimated value" },
  {
    id: "closing-month",
    label: "Closing this month",
    description: "Expected close within the month",
  },
  { id: "followup-overdue", label: "Follow-up overdue", description: "Next action already missed" },
  { id: "stale", label: "Stale opportunities", description: "No activity in 14+ days" },
  { id: "won-month", label: "Won this month", description: "Closed won in the current month" },
  { id: "lost-month", label: "Lost this month", description: "Closed lost in the current month" },
];
