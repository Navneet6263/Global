import type { CaseListItem, CaseListQueryInput } from "@/lib/backend-api/cases";
import type { XlsxCell, XlsxTone } from "./xlsx-writer";
import { opsStage, workingWith } from "../workspace/ops-queue-model";
import { caseColour, dispositionMeta, type Disposition } from "../../workflow-ui/colour-codes";

/** Operations MIS columns. Only data returned by the case register API is used. */
export const reportColumns = [
  { key: "caseNumber", label: "Case ID", group: "Case" },
  { key: "externalRef", label: "Client reference", group: "Case" },
  { key: "candidate", label: "Candidate", group: "Case" },
  { key: "employeeCode", label: "Employee code", group: "Case" },
  { key: "client", label: "Client", group: "Case" },
  { key: "branch", label: "Branch", group: "Case" },
  { key: "package", label: "Package", group: "Case" },
  { key: "stage", label: "Current stage", group: "Workflow" },
  { key: "status", label: "Status code", group: "Workflow" },
  { key: "priority", label: "Priority", group: "Workflow" },
  { key: "risk", label: "Risk level", group: "Workflow" },
  { key: "rm", label: "Responsible RM", group: "Ownership" },
  { key: "workingWith", label: "Working with", group: "Ownership" },
  { key: "checks", label: "Checks (types)", group: "Checks" },
  { key: "checksTotal", label: "Total checks", group: "Checks" },
  { key: "checksDone", label: "Completed checks", group: "Checks" },
  { key: "clear", label: "Clear", group: "Checks" },
  { key: "discrepancy", label: "Discrepancy", group: "Checks" },
  { key: "utv", label: "Unable to verify", group: "Checks" },
  { key: "colour", label: "Outcome", group: "Checks" },
  { key: "created", label: "Initiated (IST)", group: "Dates & TAT" },
  { key: "due", label: "Due (IST)", group: "Dates & TAT" },
  { key: "completed", label: "Completed (IST)", group: "Dates & TAT" },
  { key: "updated", label: "Last updated (IST)", group: "Dates & TAT" },
  { key: "tatDays", label: "TAT / ageing (days)", group: "Dates & TAT" },
  { key: "sla", label: "SLA status", group: "Dates & TAT" },
] as const;
export type ReportColumnKey = (typeof reportColumns)[number]["key"];

export const reportPresets = [
  {
    id: "status",
    label: "Case status report",
    detail: "Every case with stage, owner and outcome",
    columns: [
      "caseNumber",
      "candidate",
      "client",
      "stage",
      "rm",
      "workingWith",
      "checksDone",
      "checksTotal",
      "colour",
      "created",
      "due",
      "sla",
    ],
  },
  {
    id: "tat",
    label: "TAT & ageing report",
    detail: "Turnaround and ageing against the due date",
    columns: [
      "caseNumber",
      "candidate",
      "client",
      "stage",
      "created",
      "due",
      "completed",
      "tatDays",
      "sla",
    ],
  },
  {
    id: "discrepancy",
    label: "Discrepancy report",
    detail: "Cases with at least one discrepant check",
    columns: [
      "caseNumber",
      "candidate",
      "client",
      "checks",
      "discrepancy",
      "colour",
      "rm",
      "updated",
    ],
  },
  {
    id: "utv",
    label: "UTV report",
    detail: "Cases with an unable-to-verify check",
    columns: ["caseNumber", "candidate", "client", "checks", "utv", "colour", "rm", "updated"],
  },
  {
    id: "insufficiency",
    label: "Insufficiency report",
    detail: "Cases waiting on documents or corrections",
    columns: [
      "caseNumber",
      "candidate",
      "client",
      "stage",
      "workingWith",
      "rm",
      "created",
      "tatDays",
      "sla",
    ],
  },
  {
    id: "rm",
    label: "RM-wise workload",
    detail: "Cases grouped by responsible RM",
    columns: ["rm", "caseNumber", "candidate", "client", "stage", "due", "sla"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  detail: string;
  columns: readonly ReportColumnKey[];
}>;
export type ReportPresetId = (typeof reportPresets)[number]["id"];

export interface ReportFilters {
  from: string;
  to: string;
  clientId: string;
  ownerId: string;
  stage: string;
  scope: "active" | "all" | "completed";
}

export const emptyReportFilters: ReportFilters = {
  from: "",
  to: "",
  clientId: "",
  ownerId: "",
  stage: "",
  scope: "all",
};

export function validateReportFilters(filters: ReportFilters) {
  for (const value of [filters.from, filters.to]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new Error("Enter valid dates.");
  }
  if (filters.from && filters.to && filters.from > filters.to)
    throw new Error("From date must be on or before To date.");
}

/** Server query for one page of the report. Tenant and branch scope always come from the session. */
export function reportQuery(
  preset: ReportPresetId,
  filters: ReportFilters,
  page: number,
): CaseListQueryInput {
  const insufficiency = preset === "insufficiency";
  return {
    view: filters.scope === "active" ? "active" : undefined,
    stage: insufficiency
      ? undefined
      : filters.scope === "completed"
        ? "completed"
        : ((filters.stage || undefined) as CaseListQueryInput["stage"]),
    clientId: filters.clientId || undefined,
    ownerId: filters.ownerId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page,
    pageSize: 100,
    limit: 100,
    sortBy: "updatedAt",
    sortDir: "desc",
  };
}

/** Client-side refinements the case register has no server filter for. */
export function keepForPreset(preset: ReportPresetId, item: CaseListItem) {
  if (preset === "discrepancy") return item.checks.some((check) => check.result === "DISCREPANCY");
  if (preset === "utv") return item.checks.some((check) => check.result === "UNABLE_TO_VERIFY");
  if (preset === "insufficiency")
    return ["DOCUMENT_PENDING", "CLARIFICATION_PENDING", "CONSENT_PENDING"].includes(item.status);
  return true;
}

export type ReportRow = Record<ReportColumnKey, XlsxCell>;
const TERMINAL = new Set(["COMPLETED", "CLOSED", "CANCELLED"]);

export function istStamp(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

const TONE: Record<Disposition, XlsxTone> = {
  GREEN: "good",
  RED: "bad",
  YELLOW: "minor",
  AMBER: "warn",
  BLUE: "info",
  CLIENT_REVIEW: "info",
};

/** Business colour code of the case (its most serious check); "In progress" until a result exists. */
export function colourCode(item: Pick<CaseListItem, "checks">): { value: string; tone?: XlsxTone } {
  const colour = caseColour(item.checks);
  return colour
    ? { value: dispositionMeta[colour].label, tone: TONE[colour] }
    : { value: "In progress" };
}

export function reportRow(item: CaseListItem, now = Date.now()): ReportRow {
  const done = item.checks.filter((check) => check.status === "COMPLETED").length;
  const count = (result: string) => item.checks.filter((check) => check.result === result).length;
  const closed = TERMINAL.has(item.status);
  const end = closed && item.completedAt ? Date.parse(item.completedAt) : now;
  const start = Date.parse(item.createdAt);
  const days = Number.isFinite(start)
    ? Math.max(0, Math.round(((end - start) / 86_400_000) * 10) / 10)
    : "";
  const due = item.dueAt ? Date.parse(item.dueAt) : NaN;
  const sla: XlsxCell = !Number.isFinite(due)
    ? "No due date"
    : closed
      ? item.completedAt && Date.parse(item.completedAt) <= due
        ? { value: "Met", tone: "good" }
        : item.completedAt
          ? { value: "Missed", tone: "bad" }
          : "Closed"
      : due < now
        ? { value: "Overdue", tone: "bad" }
        : due - now <= 8 * 3_600_000
          ? { value: "Due soon", tone: "warn" }
          : { value: "On track", tone: "good" };
  const worker = workingWith(item);
  return {
    caseNumber: item.caseNumber,
    externalRef: item.externalRef ?? "",
    candidate: item.subject.fullName,
    employeeCode: item.subject.employeeCode ?? "",
    client: item.client.displayName,
    branch: item.branch?.name ?? "",
    package: item.servicePackage?.name ?? "",
    stage: opsStage(item.status).label,
    status: item.status,
    priority: item.priority,
    risk: item.riskLevel ?? "",
    rm: item.assignedOpsUser?.displayName ?? "Unassigned",
    workingWith: closed ? "" : worker.name,
    checks: [
      ...new Set(item.checks.map((check) => check.type.replaceAll("_", " ").toLowerCase())),
    ].join(", "),
    checksTotal: item.checks.length,
    checksDone: done,
    clear: count("CLEAR"),
    discrepancy: count("DISCREPANCY"),
    utv: count("UNABLE_TO_VERIFY"),
    colour: colourCode(item),
    created: istStamp(item.createdAt),
    due: istStamp(item.dueAt),
    completed: istStamp(item.completedAt),
    updated: istStamp(item.updatedAt),
    tatDays: days,
    sla,
  };
}

export function sortForPreset(preset: ReportPresetId, rows: ReportRow[]) {
  if (preset !== "rm") return rows;
  return [...rows].sort((a, b) => String(a.rm).localeCompare(String(b.rm)));
}

export function cellText(value: XlsxCell) {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? String(value.value) : String(value);
}

export function moveKey<T>(keys: readonly T[], index: number, direction: number) {
  const next = [...keys];
  const target = index + direction;
  if (index < 0 || index >= keys.length || target < 0 || target >= keys.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** CSV with BOM for Excel; text that looks like a formula is neutralised. */
export function reportCsv(rows: ReportRow[], keys: readonly ReportColumnKey[]) {
  const label = (key: ReportColumnKey) => reportColumns.find((column) => column.key === key)!.label;
  const cell = (value: XlsxCell) => {
    const raw = value !== null && typeof value === "object" ? value.value : value;
    let text = String(raw ?? "");
    if (typeof raw !== "number" && /^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      keys.map((key) => cell(label(key))).join(","),
      ...rows.map((row) => keys.map((key) => cell(row[key])).join(",")),
    ].join("\r\n")
  );
}
