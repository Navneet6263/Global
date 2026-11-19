/** Board columns for the client's pipeline: where each case is, in the client's words. */
export const PIPELINE_COLUMNS = [
  { key: "needsYou", label: "Needs you", hint: "Approve or answer to move on", tone: "warn" },
  { key: "candidate", label: "With the candidate", hint: "Consent and uploads", tone: "neutral" },
  { key: "verifying", label: "Being verified", hint: "Checks underway", tone: "brand" },
  { key: "quality", label: "Quality review", hint: "Final checks and report", tone: "note" },
  { key: "release", label: "Awaiting release", hint: "Report ready to release", tone: "warn" },
  { key: "done", label: "Completed", hint: "Report released", tone: "good" },
] as const;

export type PipelineColumn = (typeof PIPELINE_COLUMNS)[number]["key"];

interface BoardCase {
  status: string;
  updatedAt: string;
  clientProgress?: { stage: string | null } | null;
}

/** The column a case sits in, or null for cancelled / stopped cases. */
export function pipelineColumn(item: BoardCase): PipelineColumn | null {
  const stage = item.clientProgress?.stage;
  if (item.status === "CLARIFICATION_PENDING" || stage === "YOUR_REVIEW" || stage === "CORRECTION")
    return "needsYou";
  if (["DRAFT", "CONSENT_PENDING", "DOCUMENT_PENDING"].includes(item.status)) return "candidate";
  if (item.status === "IN_PROGRESS") return "verifying";
  if (["QA_REVIEW", "MANAGER_REVIEW", "REPORT_PENDING"].includes(item.status)) return "quality";
  if (item.status === "PAYMENT_PENDING") return "release";
  if (["COMPLETED", "CLOSED"].includes(item.status)) return "done";
  return null;
}

/** Whole days since the case last moved. */
export function waitingDays(item: BoardCase, now = new Date()) {
  const moved = new Date(item.updatedAt).getTime();
  if (Number.isNaN(moved)) return 0;
  return Math.max(0, Math.floor((now.getTime() - moved) / 86_400_000));
}

/** "stuck" once a case has not moved for 5 days, "late" after 10; finished work never is. */
export function waitingLevel(item: BoardCase, now = new Date()): "ok" | "stuck" | "late" {
  if (pipelineColumn(item) === "done") return "ok";
  const days = waitingDays(item, now);
  return days >= 10 ? "late" : days >= 5 ? "stuck" : "ok";
}

export function groupPipeline<T extends BoardCase>(items: readonly T[], now = new Date()) {
  const columns = Object.fromEntries(
    PIPELINE_COLUMNS.map((column) => [column.key, [] as T[]]),
  ) as Record<PipelineColumn, T[]>;
  let hidden = 0;
  for (const item of items) {
    const column = pipelineColumn(item);
    if (column) columns[column].push(item);
    else hidden += 1;
  }
  // Longest waiting first inside every column, so stuck work is seen first.
  for (const key of Object.keys(columns) as PipelineColumn[])
    columns[key].sort((a, b) => waitingDays(b, now) - waitingDays(a, now));
  return { columns, hidden };
}
