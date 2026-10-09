import { apiRequest } from "./client";

export type ExportSource =
  | "data-entry-queue"
  | "team-queue"
  | "team-members"
  | "verifier-tasks"
  | "verifier-sla"
  | "verifier-blockers"
  | "verifier-history"
  | "utv"
  | "team-annexure"
  | "qa-queue"
  | "qa-mine"
  | "qa-corrections"
  | "qa-history";

/** Records a browser-built sheet in the audit trail: which list, how many rows, which columns. */
export const logExport = (input: { source: ExportSource; rows: number; columns: string[] }) =>
  apiRequest<{ logged: boolean }>("/audit-events/exports", {
    method: "POST",
    body: JSON.stringify(input),
  });
