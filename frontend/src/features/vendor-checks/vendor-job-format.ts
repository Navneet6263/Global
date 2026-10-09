import type { VendorJobStatus } from "@/lib/backend-api/vendor-checks";

export const readable = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

/** Status wording for each side, with a pill tone. */
export const STATUS_COPY: Record<
  VendorJobStatus,
  { vendor: string; internal: string; tone: string }
> = {
  PENDING_APPROVAL: { vendor: "", internal: "Waiting for RM approval", tone: "is-warn" },
  REJECTED: { vendor: "", internal: "Turned down by RM", tone: "" },
  ASSIGNED: { vendor: "New", internal: "Waiting for vendor", tone: "is-info" },
  IN_PROGRESS: { vendor: "In progress", internal: "With vendor", tone: "is-info" },
  SUBMITTED: { vendor: "Submitted", internal: "To review", tone: "is-warn" },
  RETURNED: { vendor: "Returned to you", internal: "Returned", tone: "is-bad" },
  APPROVED: { vendor: "Approved", internal: "Approved", tone: "is-good" },
  DECLINED: { vendor: "Declined", internal: "Declined by vendor", tone: "is-bad" },
  CANCELLED: { vendor: "Withdrawn", internal: "Cancelled", tone: "" },
};

export const fileSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
