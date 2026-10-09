import type { QueueCase } from "@/lib/backend-api/workflow";

export type Tone = "good" | "warn" | "bad" | "info";

/** Where a v2 case sits in the flow and who holds it, from the queue row only. */
export function flowPosition(
  item: Pick<
    QueueCase,
    "status" | "intakeStage" | "dataEntry" | "rm" | "checks" | "openInsufficiency"
  >,
): {
  label: string;
  holder: string;
  tone: Tone;
} {
  if (item.status === "MANAGER_REVIEW")
    return { label: "Final approval", holder: item.rm?.name ?? "RM", tone: "info" };
  if (item.status === "QA_REVIEW") return { label: "QC review", holder: "QC", tone: "info" };
  if (["REPORT_PENDING", "PAYMENT_PENDING"].includes(item.status))
    return { label: "Report & release", holder: "Report / Finance", tone: "good" };
  if (["COMPLETED", "CLOSED"].includes(item.status))
    return { label: "Completed", holder: "—", tone: "good" };
  if (item.status === "CANCELLED") return { label: "Cancelled", holder: "—", tone: "bad" };
  if (item.status === "STOPPED")
    return { label: "Stopped", holder: "Client instruction", tone: "bad" };
  switch (item.intakeStage) {
    case "CLIENT_REVIEW":
      return { label: "Client reviewing submission", holder: "Client", tone: "info" };
    case "CLIENT_RETURNED":
      return { label: "Returned by client", holder: "Candidate", tone: "warn" };
    case "INTAKE":
      return item.status === "DOCUMENT_PENDING"
        ? { label: "Assign Data Entry", holder: item.rm?.name ?? "RM", tone: "warn" }
        : { label: "Candidate submission", holder: "Candidate", tone: "info" };
    case "DATA_ENTRY":
      return {
        label: "Data Entry review",
        holder: item.dataEntry?.name ?? "Data Entry",
        tone: "info",
      };
    case "CORRECTION":
      return { label: "Correction (L1)", holder: "Candidate / client", tone: "warn" };
    case "READY":
      return { label: "Ready to route", holder: item.rm?.name ?? "RM", tone: "warn" };
    case "ROUTED":
      if (item.openInsufficiency.l2)
        return { label: "Insufficiency (L2)", holder: "Candidate / client", tone: "warn" };
      if (item.checks.unassigned)
        return {
          label: "Awaiting team member",
          holder: item.checks.departments.join(", ") || "Team Leader",
          tone: "warn",
        };
      return {
        label: "In verification",
        holder: item.checks.departments.join(", ") || "Verification",
        tone: "info",
      };
    default:
      return { label: item.status.toLowerCase().replaceAll("_", " "), holder: "—", tone: "info" };
  }
}

export function dueLabel(dueAt: string | null, now = Date.now()): { text: string; tone: Tone } {
  if (!dueAt || !Number.isFinite(Date.parse(dueAt))) return { text: "No due date", tone: "info" };
  const minutes = Math.round((Date.parse(dueAt) - now) / 60_000);
  const span = (value: number) =>
    value >= 1440
      ? `${Math.floor(value / 1440)}d`
      : value >= 60
        ? `${Math.floor(value / 60)}h`
        : `${Math.max(1, value)}m`;
  if (minutes < 0) return { text: `Overdue ${span(-minutes)}`, tone: "bad" };
  return { text: `${span(minutes)} left`, tone: minutes <= 8 * 60 ? "warn" : "good" };
}

export function sinceLabel(value: string | null, now = Date.now()) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const minutes = Math.max(0, Math.round((now - Date.parse(value)) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function readableCheck(type: string) {
  return type
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Default department per check: the RM's earlier choice, else the department suggestion. */
export function defaultRoutes(
  checks: Array<{
    id: string;
    status: string;
    department: { id: string } | null;
    suggestedDepartmentId: string | null;
  }>,
) {
  return Object.fromEntries(
    checks
      .filter((check) => check.status !== "COMPLETED")
      .map((check) => [check.id, check.department?.id ?? check.suggestedDepartmentId ?? ""]),
  ) as Record<string, string>;
}

const STOPPABLE = [
  "CONSENT_PENDING",
  "DOCUMENT_PENDING",
  "IN_PROGRESS",
  "CLARIFICATION_PENDING",
  "QA_REVIEW",
];

/** Matches the API: only work still in progress can be stopped on client instruction. */
export function canStop(status: string) {
  return STOPPABLE.includes(status);
}
