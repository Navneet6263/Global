import type { CaseQuery, CaseStage, CasePriority, SlaState } from "@/lib/contracts/case";

export type CaseColumnId =
  | "candidate"
  | "caseNumber"
  | "client"
  | "package"
  | "stage"
  | "progress"
  | "priority"
  | "sla"
  | "owner"
  | "updated";

export interface CaseColumn {
  id: CaseColumnId;
  label: string;
  sortKey?: NonNullable<CaseQuery["sortBy"]>;
  alwaysVisible?: boolean;
  className?: string;
}

export const CASE_COLUMNS: readonly CaseColumn[] = [
  { id: "candidate", label: "Candidate", sortKey: "candidateName", alwaysVisible: true },
  { id: "caseNumber", label: "Case number" },
  { id: "client", label: "Client" },
  { id: "package", label: "Package" },
  { id: "stage", label: "Stage", alwaysVisible: true },
  { id: "progress", label: "Progress", sortKey: "progress" },
  { id: "priority", label: "Priority" },
  { id: "sla", label: "SLA remaining", sortKey: "sla" },
  { id: "owner", label: "Operations owner" },
  { id: "updated", label: "Last updated", sortKey: "updatedAt" },
];

export const DEFAULT_VISIBLE_COLUMNS: readonly CaseColumnId[] = CASE_COLUMNS.map(
  (column) => column.id,
);

export interface SavedView {
  id: string;
  label: string;
  description: string;
  query: Partial<CaseQuery>;
}

export const SAVED_VIEWS: readonly SavedView[] = [
  {
    id: "all",
    label: "All active work",
    description: "Everything currently open across clients",
    query: { stage: "all", priority: "all", sla: "all" },
  },
  {
    id: "sla-risk",
    label: "SLA risk",
    description: "Approaching breach, soonest first",
    query: { sla: "approaching", sortBy: "sla", sortDir: "asc" },
  },
  {
    id: "overdue",
    label: "Overdue",
    description: "Breached the client commitment",
    query: { sla: "overdue", sortBy: "sla", sortDir: "asc" },
  },
  {
    id: "critical",
    label: "Critical priority",
    description: "Executive and regulated hires",
    query: { priority: "critical", sortBy: "updatedAt", sortDir: "desc" },
  },
  {
    id: "qa",
    label: "In QA review",
    description: "Awaiting sampling and sign-off",
    query: { stage: "qa" },
  },
];

export const STAGE_OPTIONS: readonly { value: CaseStage | "all"; label: string }[] = [
  { value: "all", label: "All stages" },
  { value: "intake", label: "Case intake" },
  { value: "consent", label: "Consent" },
  { value: "documents", label: "Documents" },
  { value: "verification", label: "Verification" },
  { value: "clarification", label: "Clarification" },
  { value: "qa", label: "QA review" },
  { value: "completed", label: "Completed" },
];

export const PRIORITY_OPTIONS: readonly { value: CasePriority | "all"; label: string }[] = [
  { value: "all", label: "All priorities" },
  { value: "standard", label: "Standard" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const SLA_OPTIONS: readonly { value: SlaState | "all"; label: string }[] = [
  { value: "all", label: "Any SLA state" },
  { value: "healthy", label: "Healthy" },
  { value: "approaching", label: "Approaching breach" },
  { value: "overdue", label: "Overdue" },
];
