import type { OnboardingDocumentState, OnboardingSummary } from "@/lib/backend-api/onboarding";

export const docRowClass = (state: OnboardingDocumentState) =>
  state === "APPROVED"
    ? "is-approved"
    : state === "PENDING"
      ? "is-pending"
      : state === "REJECTED"
        ? "is-rejected"
        : "";

/** Where the company is in its journey, for chips and the hero. */
export function onboardingStatus(company: Pick<OnboardingSummary, "status" | "submittedAt">) {
  if (company.status === "ACTIVE") return { label: "Live", className: "is-live" };
  if (company.status === "SUSPENDED") return { label: "Not approved", className: "is-closed" };
  if (company.submittedAt) return { label: "In Operations review", className: "is-review" };
  return { label: "Onboarding in progress", className: "" };
}

export const shortDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      }).format(new Date(value))
    : "—";

export const daysSince = (value: string | null | undefined) =>
  value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)) : 0;

export const fileSize = (bytes: number) =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const initialsOf = (name: string | null | undefined) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export const shortDay = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(value))
    : "—";

/** Plain words for each activity entry; unknown actions fall back to a tidy version. */
export const ACTIVITY_LABELS: Record<string, string> = {
  "client.self-signup": "Company signed up",
  "client.onboarding.details-updated": "Company details updated",
  "client.agreement-file.uploaded": "Document uploaded",
  "client.agreement-file.reviewed": "Document reviewed",
  "client.agreement-file.downloaded": "Document opened",
  "client.onboarding.submitted": "Submitted for review",
  "client.onboarding.message": "Message sent to the company",
  "client.commercial.updated": "Packages & pricing updated",
  "client-pricing.discount-set": "Client discount set",
  "client.primary-rm-assigned": "Company RM assigned",
  "client.primary-rm-removed": "Company RM removed",
  "client.onboarding.activated": "Approved and activated",
  "client.onboarding.rejected": "Sign-up rejected",
};

export const activityLabel = (action: string) =>
  ACTIVITY_LABELS[action] ??
  action
    .replace(/^client[.-]/, "")
    .replace(/[.-]/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());

const IST = "Asia/Kolkata";
const dayKey = (value: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date(value));

/** "Today", "Yesterday" or a date, in India time. */
export function activityDay(value: string) {
  const day = dayKey(value);
  if (day === dayKey(new Date().toISOString())) return "Today";
  if (day === dayKey(new Date(Date.now() - 86_400_000).toISOString())) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST,
  }).format(new Date(value));
}

export const activityTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: IST }).format(
    new Date(value),
  );
