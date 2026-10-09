import type { ColumnOption } from "@/components/table/use-column-choice";
import type { QueueCase, RmBucket } from "@/lib/backend-api/workflow";

export type RmColumn = "stage" | "working" | "checks" | "documents" | "due" | "received";

/** Columns the RM can show or hide; candidate and next action are always shown. */
export const RM_COLUMNS: readonly ColumnOption<RmColumn>[] = [
  { key: "stage", label: "Current stage" },
  { key: "working", label: "Working with" },
  { key: "checks", label: "Checks progress" },
  { key: "documents", label: "Documents" },
  { key: "due", label: "Due" },
  { key: "received", label: "Received" },
];
export const RM_DEFAULT_COLUMNS: readonly RmColumn[] = ["stage", "working", "checks", "due"];

export type RmActionKind = "data-entry" | "route" | "send-back" | "final" | "stop";

/** The one thing the RM should do next on this case, if anything. */
export function nextAction(item: QueueCase): { label: string; kind: RmActionKind } | null {
  if (item.status === "MANAGER_REVIEW") return { label: "Review & decide", kind: "final" };
  if (item.intakeStage === "READY") return { label: "Route checks", kind: "route" };
  if (item.intakeStage === "INTAKE" && item.status === "DOCUMENT_PENDING")
    return { label: "Assign Data Entry", kind: "data-entry" };
  return null;
}

/** Quick tabs above the table: the steps that wait on the RM, plus corrections. */
export const ACTION_TABS: ReadonlyArray<{ value: RmBucket; label: string }> = [
  { value: "needs_data_entry", label: "Assign Data Entry" },
  { value: "ready", label: "Ready to route" },
  { value: "final_approval", label: "Final review" },
  { value: "correction", label: "Corrections" },
];

export const PAGE_SIZES = [10, 20, 50] as const;

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";
