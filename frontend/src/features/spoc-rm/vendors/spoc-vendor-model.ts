import type { StatusTone } from "@/lib/contracts/common";
import type {
  DocumentVersionEntry,
  ReuploadRequestEntry,
  ReuploadState,
  VendorAttempt,
  VendorDocumentStatus,
} from "./spoc-vendor-contracts";

export const VENDOR_TEXT_MIN = 5;
export const VENDOR_TEXT_MAX = 1000;

/** Mirrors the server rule (trimmed, 5–1000 characters); the server remains the authority. */
export function isValidVendorText(value: string): boolean {
  const length = value.trim().length;
  return length >= VENDOR_TEXT_MIN && length <= VENDOR_TEXT_MAX;
}

export const VENDOR_STATUS_META: Record<VendorDocumentStatus, { label: string; tone: StatusTone }> =
  {
    NOT_ASSIGNED: { label: "Not assigned", tone: "neutral" },
    PENDING: { label: "With vendor", tone: "info" },
    APPROVED: { label: "Approved", tone: "success" },
    REJECTED: { label: "Rejected — needs re-assignment", tone: "critical" },
  };

/** The re-upload loop next to the vendor status; NONE shows nothing extra. */
export const REUPLOAD_META: Record<
  Exclude<ReuploadState, "NONE">,
  { label: string; tone: StatusTone }
> = {
  REQUESTED: { label: "Re-upload requested", tone: "warning" },
  RECEIVED: { label: "New version ready", tone: "info" },
};

export type HistoryStepKind =
  | "assigned"
  | "rejected"
  | "resolution"
  | "reassigned"
  | "approved"
  | "pending"
  | "reupload"
  | "upload";

export interface HistoryStep {
  key: string;
  kind: HistoryStepKind;
  title: string;
  detail: string | null;
  actor: string | null;
  at: string | null;
}

/**
 * The chain as SPOC-RM reads it: Assigned → Rejected (reason) → Issue resolved →
 * Re-assigned → … → current status. Earlier attempts are shown exactly as recorded.
 */
export function historySteps(attempts: readonly VendorAttempt[]): HistoryStep[] {
  return [...attempts]
    .sort((left, right) => left.attempt - right.attempt)
    .flatMap((row) => {
      const again = row.attempt > 1;
      const steps: HistoryStep[] = [];
      if (again)
        steps.push({
          key: `${row.id}-resolution`,
          kind: "resolution",
          title: "Issue resolved",
          detail: row.resolutionNote,
          actor: row.assignedBy,
          at: row.assignedAt,
        });
      steps.push({
        key: `${row.id}-assigned`,
        kind: again ? "reassigned" : "assigned",
        title: `${again ? "Re-assigned" : "Assigned"} to ${row.vendor.name}`,
        detail: `File version ${row.documentVersion}${row.note ? ` · ${row.note}` : ""}`,
        actor: row.assignedBy,
        at: row.assignedAt,
      });
      if (row.status === "PENDING")
        steps.push({
          key: `${row.id}-pending`,
          kind: "pending",
          title: `Waiting for ${row.vendor.name}`,
          detail: null,
          actor: null,
          at: null,
        });
      else
        steps.push({
          key: `${row.id}-decision`,
          kind: row.status === "APPROVED" ? "approved" : "rejected",
          title: `${row.status === "APPROVED" ? "Approved" : "Rejected"} by ${row.vendor.name}`,
          detail: row.reason,
          actor: row.decidedBy,
          at: row.decidedAt,
        });
      return steps;
    });
}

/**
 * The whole document story in time order: vendor attempts, re-upload requests sent
 * to the candidate and each new file version. "Waiting for vendor" stays last.
 */
export function timelineSteps(
  attempts: readonly VendorAttempt[],
  reuploads: readonly ReuploadRequestEntry[] = [],
  versions: readonly DocumentVersionEntry[] = [],
): HistoryStep[] {
  const base = historySteps(attempts);
  const extra: HistoryStep[] = [
    ...reuploads.map((entry, index) => ({
      key: `reupload-${index}`,
      kind: "reupload" as const,
      title: `Sent back to the candidate for re-upload${entry.documentVersion ? ` (v${entry.documentVersion})` : ""}`,
      detail: entry.message,
      actor: entry.requestedBy,
      at: entry.requestedAt,
    })),
    ...versions
      .filter((entry) => entry.version > 1)
      .map((entry) => ({
        key: `version-${entry.version}`,
        kind: "upload" as const,
        title: `Version v${entry.version} uploaded`,
        detail: null,
        actor: entry.uploadedBy,
        at: entry.uploadedAt,
      })),
  ];
  const time = (step: HistoryStep) => (step.at ? new Date(step.at).getTime() : 0);
  const dated = [...base.filter((step) => step.at), ...extra].sort(
    (left, right) => time(left) - time(right),
  );
  return [...dated, ...base.filter((step) => !step.at)];
}
