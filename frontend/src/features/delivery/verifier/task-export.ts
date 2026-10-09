import type { SheetColumn } from "@/components/workspace/export-sheet";
import { collectCursorPages, humanizeCode, istText } from "@/components/workspace/format";
import { getMyTasks, type VerificationTask } from "@/lib/api/tasks";

/** Columns a verifier can put in a sheet of their own checks. */
export const TASK_EXPORT_COLUMNS: readonly SheetColumn<VerificationTask>[] = [
  { key: "caseNumber", label: "Sapling ID", value: (t) => t.check.case.caseNumber },
  { key: "candidate", label: "Candidate", value: (t) => t.check.case.subject.fullName },
  { key: "company", label: "Company", value: (t) => t.check.case.client.displayName },
  { key: "check", label: "Check", value: (t) => humanizeCode(t.check.type) },
  { key: "status", label: "Status", value: (t) => humanizeCode(t.status) },
  { key: "result", label: "Result", value: (t) => humanizeCode(t.check.result) },
  { key: "priority", label: "Priority", value: (t) => humanizeCode(t.check.case.priority) },
  { key: "dueAt", label: "Due", value: (t) => istText(t.dueAt) },
  { key: "startedAt", label: "Started", value: (t) => istText(t.startedAt) },
  { key: "completedAt", label: "Completed", value: (t) => istText(t.completedAt) },
  { key: "blocker", label: "Blocker", value: (t) => t.blockerReason },
  { key: "risk", label: "Risk level", value: (t) => humanizeCode(t.check.riskLevel) },
];

export const TASK_EXPORT_DEFAULTS = [
  "caseNumber",
  "candidate",
  "company",
  "check",
  "status",
  "dueAt",
];

type TaskFilter = Omit<Parameters<typeof getMyTasks>[0], "cursor" | "limit" | "taskId">;

/** Every task matching the filter (bounded) for an export. */
export const loadAllTasks = (filter: TaskFilter) =>
  collectCursorPages((cursor) =>
    getMyTasks({ ...filter, limit: 100, ...(cursor ? { cursor } : {}) }),
  );
