import type { CaseDetail } from "@/lib/api/cases";
import { caseStatusLabel, humanize } from "./client-portal-utils";

export const activityKinds = [
  "Case",
  "Consent",
  "Documents",
  "Checks",
  "Requests",
  "Reports",
] as const;
export type CaseActivity = {
  id: string;
  kind: (typeof activityKinds)[number];
  title: string;
  detail: string;
  at: string;
};
export function caseDate(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return (
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(value)) + " IST"
  );
}
export function clientCaseActivity(item: CaseDetail): CaseActivity[] {
  const events: CaseActivity[] = [];
  const add = (
    id: string,
    kind: CaseActivity["kind"],
    title: string,
    at?: string | null,
    detail = "",
  ) => {
    if (at && Number.isFinite(Date.parse(at))) events.push({ id, kind, title, at, detail });
  };
  add("created", "Case", "Verification case created", item.createdAt, item.caseNumber);
  item.statusHistory.forEach((event, index) =>
    add(
      `stage-${index}`,
      "Case",
      caseStatusLabel(event.toStatus),
      event.createdAt,
      event.fromStatus ? `Moved from ${caseStatusLabel(event.fromStatus)}` : "Status recorded",
    ),
  );
  item.consents.forEach((consent) => {
    add(`consent-${consent.publicId}`, "Consent", "Consent request created", consent.createdAt);
    add(`accepted-${consent.publicId}`, "Consent", "Consent accepted", consent.acceptedAt);
    add(`withdrawn-${consent.publicId}`, "Consent", "Consent withdrawn", consent.withdrawnAt);
  });
  item.documents.forEach((document) => {
    document.versions.forEach((version) =>
      add(
        `doc-${document.publicId}-${version.version}`,
        "Documents",
        `${humanize(document.type)} uploaded`,
        version.createdAt,
        `Version ${version.version}`,
      ),
    );
    add(
      `review-${document.publicId}`,
      "Documents",
      `${humanize(document.type)} reviewed`,
      document.reviewedAt,
      `Current status: ${humanize(document.status)}`,
    );
  });
  item.checks.forEach((check) =>
    add(
      `check-${check.publicId}`,
      "Checks",
      `${humanize(check.type)} check completed`,
      check.completedAt,
      check.result ? `Outcome: ${humanize(check.result)}` : "Outcome not provided in this record",
    ),
  );
  item.clarifications.forEach((request) => {
    add(
      `request-${request.publicId}`,
      "Requests",
      "Information requested",
      request.createdAt,
      request.subject,
    );
    add(
      `resolved-${request.publicId}`,
      "Requests",
      "Information request resolved",
      request.resolvedAt,
      request.subject,
    );
  });
  item.reports.forEach((report) =>
    add(
      `report-${report.publicId}`,
      "Reports",
      "Report published",
      report.publishedAt,
      `Version ${report.currentVersion} · Download from Reports`,
    ),
  );
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
}

const nextSteps: Record<string, { title: string; text: string; target: string; action: string }> = {
  CONSENT_PENDING: {
    title: "Candidate consent is needed",
    text: "Ask the candidate to complete consent using their secure consent link. Verification cannot proceed without it.",
    target: "timeline",
    action: "View consent activity",
  },
  DOCUMENT_PENDING: {
    title: "Check the candidate’s documents",
    text: "Review available documents and any replacement requests. The verification team will confirm when the case is ready.",
    target: "documents",
    action: "View documents",
  },
  CLARIFICATION_PENDING: {
    title: "Your response may be needed",
    text: "Open the requests from the verification team and provide the missing information.",
    target: "requests",
    action: "Open requests",
  },
  IN_PROGRESS: {
    title: "The verification team is working",
    text: "Follow individual check statuses below. Any information needed from you will appear under Requests.",
    target: "checks",
    action: "View check progress",
  },
  QA_REVIEW: {
    title: "Evidence is in quality review",
    text: "Check completion is not final report release. The quality team is reviewing the case.",
    target: "timeline",
    action: "View review activity",
  },
  MANAGER_REVIEW: {
    title: "Final approval is pending",
    text: "The case is awaiting the authorised approval decision. Track recorded updates in the activity timeline.",
    target: "timeline",
    action: "View approval activity",
  },
  REPORT_PENDING: {
    title: "The final report is being prepared",
    text: "Downloads become available in Reports only after authorised publication and release.",
    target: "timeline",
    action: "View report activity",
  },
  PAYMENT_PENDING: {
    title: "Payment / release clearance is pending",
    text: "Check Invoices & payments for recorded dues. Completing checks alone does not unlock the final report.",
    target: "timeline",
    action: "View release activity",
  },
  COMPLETED: {
    title: "Verification is complete",
    text: "Open Reports to check the published report and its download availability.",
    target: "timeline",
    action: "View completion activity",
  },
  CLOSED: {
    title: "This case is closed",
    text: "Documents and recorded activity remain available within your access permissions.",
    target: "timeline",
    action: "View case history",
  },
  CANCELLED: {
    title: "This verification was cancelled",
    text: "Cancellation does not mean verification passed. Contact support if you need more information.",
    target: "timeline",
    action: "View case history",
  },
};
export function clientNextStep(status: string) {
  return (
    nextSteps[status === "QA_PENDING" ? "QA_REVIEW" : status] ?? {
      title: caseStatusLabel(status),
      text: "Review the recorded case details or contact support for the next step.",
      target: "checks",
      action: "View checks",
    }
  );
}
export const caseJourney = [
  { label: "Consent", statuses: ["CONSENT_PENDING"] },
  { label: "Documents", statuses: ["DOCUMENT_PENDING"] },
  { label: "Verification", statuses: ["IN_PROGRESS", "CLARIFICATION_PENDING"] },
  { label: "Quality review", statuses: ["QA_REVIEW", "QA_PENDING"] },
  { label: "Approval", statuses: ["MANAGER_REVIEW"] },
  {
    label: "Report & release",
    statuses: ["REPORT_PENDING", "PAYMENT_PENDING", "COMPLETED", "CLOSED"],
  },
];
