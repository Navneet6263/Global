export type ConsentDelivery = {
  channel: "SMS" | "EMAIL";
  destination: string | null;
  otp: string;
  consentUrl: string;
  expiresAt: string;
  issuedAt: string;
};

export type ExecutiveDelivery = {
  recipientEmail: string;
  format: "pdf" | "csv";
  dashboardUrl: string;
  exportUrl: string;
  deliveryAt: string;
};

export type CandidateAccessDelivery = {
  accessId: string;
  channel: "SMS" | "EMAIL";
  destination: string;
  portalUrl: string;
  expiresAt: string;
};

export const NOOP_TOPICS = new Set([
  "case.created",
  "case.status.changed",
  "consent.accepted",
  "clarification.responded",
  "verification.check.completed",
  "verification.case.ready-for-qa",
]);
