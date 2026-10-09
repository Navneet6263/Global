import type { EmailTemplate } from "../common/mail/email-templates";

export type ConsentDelivery = {
  channel: "SMS" | "EMAIL";
  destination: string | null;
  otp: string;
  /** Absent when the code was asked for inside the candidate link. */
  consentUrl?: string;
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
  /** Set when the team asks the candidate for something again. */
  reason?: string;
};

export const NOOP_TOPICS = new Set([
  "case.created",
  "case.status.changed",
  "consent.accepted",
  "clarification.responded",
  "verification.check.completed",
  "verification.case.ready-for-qa",
]);

/** Direct transactional email; the payload is sealed because it can hold an OTP. */
export type EmailAttachmentRef = {
  filename: string;
  contentType: string;
} & (
  | { objectKey: string; base64?: undefined }
  | { base64: string; objectKey?: undefined }
);

export type EmailDelivery = {
  to: string;
  template: EmailTemplate;
  variables: Record<string, unknown>;
  cc?: string[];
  /** Stored case documents, read from object storage at send time. */
  attachments?: EmailAttachmentRef[];
};
