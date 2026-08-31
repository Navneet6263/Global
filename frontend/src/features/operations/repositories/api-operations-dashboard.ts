import {
  getExceptionsDashboard,
  getExecutiveDashboard,
  getOperationsDashboard,
} from "@/lib/backend-api/dashboards";
import type { OpsStage, OpsPriority } from "../contracts/case";
import type { OpsMetric, OpsStageSnapshot } from "../contracts/operations";
import { slaOf, stages } from "./api-operations-mappers";

export async function getOperationsWorkspaceDashboard() {
  const [ops, executive, exceptions] = await Promise.all([
    getOperationsDashboard(),
    getExecutiveDashboard({ months: 12 }),
    getExceptionsDashboard(),
  ]);
  const active =
    ops.summary.total -
    (ops.statusMix["COMPLETED"] ?? 0) -
    (ops.statusMix["CLOSED"] ?? 0) -
    (ops.statusMix["CANCELLED"] ?? 0);
  const metrics: OpsMetric[] = [
    snapshotMetric("active", "Active workload", "Cases currently in delivery", active, "info"),
    snapshotMetric(
      "unassigned",
      "Unassigned",
      "Cases without an operations owner",
      executive.forecast.unassignedActive,
      executive.forecast.unassignedActive ? "warning" : "success",
    ),
    snapshotMetric(
      "dueToday",
      "Due next 7 days",
      "Delivery commitments due within seven days",
      executive.forecast.dueNext7Days,
      "warning",
    ),
    {
      ...snapshotMetric(
        "slaRisk",
        "SLA risk",
        "Cases already overdue",
        ops.summary.overdue,
        ops.summary.overdue ? "critical" : "success",
      ),
      series: executive.performanceTrend.map((row) => row.overdue),
    },
    snapshotMetric(
      "clarifications",
      "Clarifications",
      "Open stakeholder responses",
      exceptions.summary.clarifications,
      exceptions.summary.clarifications ? "warning" : "success",
    ),
    {
      ...snapshotMetric(
        "completedToday",
        "Completed today",
        "Cases closed today",
        ops.summary.completedToday,
        "success",
      ),
      series: ops.trend.map((row) => row.completed),
    },
  ];
  const actions = executive.attentionQueue.map((item) => ({
    id: item.id,
    kind: item.reasons.some((reason) => reason.toLowerCase().includes("overdue"))
      ? ("sla_overdue" as const)
      : ("sla_approaching" as const),
    treatment: item.severity >= 3 ? ("critical" as const) : ("action" as const),
    severity: severity(item.severity),
    caseId: item.id,
    caseNumber: item.caseNumber,
    candidateName: item.subject.fullName,
    clientName: item.client.displayName,
    stage: stages[item.status] ?? "verification",
    issue: item.reasons.join(" · "),
    waitingMinutes: Math.round(item.ageHours * 60),
    slaMinutesRemaining: slaOf(item.dueAt).minutes,
    owner: item.owner?.displayName ?? "Unassigned",
    nextAction: item.owner ? "Review case" : "Assign owner",
  }));
  return {
    generatedAt: ops.generatedAt,
    metrics,
    stages: stageSnapshots(ops.stageHealth ?? []),
    actions,
    throughput: ops.trend.map((row) => ({
      label: row.month,
      created: row.created,
      completed: row.completed,
    })),
  };
}

function snapshotMetric(
  id: OpsMetric["id"],
  label: string,
  explanation: string,
  value: number,
  tone: OpsMetric["tone"],
): OpsMetric {
  return { id, label, explanation, value, tone, series: [], filterLabel: label };
}

function severity(value: number): OpsPriority {
  if (value >= 3) return "critical";
  if (value >= 2) return "high";
  return "standard";
}

function stageSnapshots(
  rows: Array<{
    status: string;
    count: number;
    oldestAgeHours: number;
    atRisk: number;
  }>,
): OpsStageSnapshot[] {
  const groups = new Map<OpsStage, Omit<OpsStageSnapshot, "percent">>();
  rows.forEach((row) => {
    if (row.status === "CANCELLED") return;
    const stage = stages[row.status] ?? "verification";
    const current = groups.get(stage) ?? emptyStage(stage);
    const count = current.count + row.count;
    groups.set(stage, {
      ...current,
      count,
      oldestAgeMinutes: Math.max(current.oldestAgeMinutes, Math.round(row.oldestAgeHours * 60)),
      slaRiskCount: current.slaRiskCount + row.atRisk,
      bottleneck: current.bottleneck || row.atRisk > 0,
    });
  });
  const total = Math.max(
    1,
    [...groups.values()].reduce((sum, row) => sum + row.count, 0),
  );
  return [...groups.values()].map((row) => ({
    ...row,
    percent: Math.round((row.count / total) * 100),
  }));
}

function emptyStage(stage: OpsStage): Omit<OpsStageSnapshot, "percent"> {
  return {
    stage,
    count: 0,
    oldestAgeMinutes: 0,
    slaRiskCount: 0,
    bottleneck: false,
  };
}
