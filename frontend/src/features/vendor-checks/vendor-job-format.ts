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
  OPEN: { vendor: "In the open queue", internal: "In the open vendor queue", tone: "is-warn" },
  ASSIGNED: { vendor: "New", internal: "Waiting for vendor", tone: "is-info" },
  IN_PROGRESS: { vendor: "In progress", internal: "With vendor", tone: "is-info" },
  TEAM_REVIEW: {
    vendor: "With your Team Leader",
    internal: "Vendor Team Leader reviewing",
    tone: "is-info",
  },
  SUBMITTED: { vendor: "Submitted", internal: "To review", tone: "is-warn" },
  RETURNED: { vendor: "Returned to you", internal: "Returned", tone: "is-bad" },
  APPROVED: { vendor: "Approved", internal: "Approved", tone: "is-good" },
  DECLINED: { vendor: "Declined", internal: "Declined by vendor", tone: "is-bad" },
  CANCELLED: { vendor: "Withdrawn", internal: "Cancelled", tone: "" },
};

export const rupees = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

/** "Open queue" while nobody has picked it yet. */
export const vendorName = (vendor: { name: string } | null) => vendor?.name ?? "Open queue";

export const fileSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
