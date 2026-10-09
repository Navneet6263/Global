import type { ColumnOption } from "@/components/table/column-picker";

/** Optional columns of the Operations work queue (candidate and action are always shown). */
export const opsQueueColumns = [
  { key: "stage", label: "Stage" },
  { key: "outcome", label: "Outcome" },
  { key: "rm", label: "Responsible RM" },
  { key: "companyRm", label: "Company RM" },
  { key: "working", label: "Working with" },
  { key: "due", label: "Due" },
  { key: "package", label: "Package" },
  { key: "priority", label: "Priority" },
  { key: "checks", label: "Checks done" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Last updated" },
] as const satisfies readonly ColumnOption<string>[];

export type OpsQueueColumn = (typeof opsQueueColumns)[number]["key"];

export const defaultOpsQueueColumns: readonly OpsQueueColumn[] = [
  "stage",
  "outcome",
  "rm",
  "working",
  "due",
];

export const OPS_QUEUE_COLUMNS_KEY = "sapling.ops.queue-columns.v1";
