import { getExecutiveDashboard, getOperationsDashboard } from "@/lib/backend-api/dashboards";
import { slaOf, stages } from "./api-operations-mappers";

export async function getOperationsWorkspaceDashboard() {
  const [ops, executive] = await Promise.all([
    getOperationsDashboard(),
    getExecutiveDashboard({ months: 12 }),
  ]);
  const active =
    ops.summary.total - (ops.statusMix["COMPLETED"] ?? 0) - (ops.statusMix["CLOSED"] ?? 0);
  const metrics = [
    {
      id: "active" as const,
      label: "Active workload",
      explanation: "Cases currently in delivery",
      value: active,
      previousValue: active,
      deltaPercent: 0,
      direction: "flat" as const,
      tone: "info" as const,
      series: ops.trend.map((row) => row.created),
      filterLabel: "Active",
    },
    {
      id: "unassigned" as const,
      label: "Unassigned",
      explanation: "Cases without an operations owner",
      value: executive.forecast.unassignedActive,
      previousValue: executive.forecast.unassignedActive,
      deltaPercent: 0,
      direction: "flat" as const,
      tone: executive.forecast.unassignedActive ? ("warning" as const) : ("success" as const),
      series: ops.trend.map(() => 0),
      filterLabel: "Unassigned",
    },
    {
      id: "dueToday" as const,
      label: "Due today",
      explanation: "Delivery commitments due today",
      value: executive.forecast.dueNext7Days,
      previousValue: executive.forecast.dueNext7Days,
      deltaPercent: 0,
      direction: "flat" as const,
      tone: "warning" as const,
      series: executive.performanceTrend.map((row) => row.overdue),
      filterLabel: "Due today",
    },
    {
      id: "slaRisk" as const,
      label: "SLA risk",
      explanation: "Cases already overdue",
      value: ops.summary.overdue,
      previousValue: ops.summary.overdue,
      deltaPercent: 0,
      direction: "flat" as const,
      tone: ops.summary.overdue ? ("critical" as const) : ("success" as const),
      series: executive.performanceTrend.map((row) => row.overdue),
      filterLabel: "SLA risk",
    },
    {
      id: "clarifications" as const,
      label: "Clarifications",
      explanation: "Open stakeholder responses",
      value: 0,
      previousValue: 0,
      deltaPercent: 0,
      direction: "flat" as const,
      tone: "warning" as const,
      series: ops.trend.map(() => 0),
      filterLabel: "Clarifications",
    },
    {
      id: "completedToday" as const,
      label: "Completed today",
      explanation: "Cases closed today",
      value: ops.summary.completedToday,
      previousValue: ops.summary.completedToday,
      deltaPercent: 0,
      direction: "flat" as const,
      tone: "success" as const,
      series: ops.trend.map((row) => row.completed),
      filterLabel: "Completed today",
    },
  ];
  const total = Math.max(1, ops.summary.total);
  const stagesData = Object.entries(ops.statusMix).map(([status, count]) => ({
    stage: stages[status] ?? "verification",
    count,
    percent: Math.round((count / total) * 100),
    averageAgeMinutes: 0,
    oldestAgeMinutes: 0,
    slaRiskCount: Math.min(count, ops.summary.overdue),
    unassignedCount: 0,
    bottleneck: false,
  }));
  const actions = executive.attentionQueue.map((item) => ({
    id: item.id,
    kind: item.reasons.some((reason) => reason.toLowerCase().includes("overdue"))
      ? ("sla_overdue" as const)
      : ("sla_approaching" as const),
    treatment: item.severity >= 3 ? ("critical" as const) : ("action" as const),
    severity:
      item.severity >= 3
        ? ("critical" as const)
        : item.severity >= 2
          ? ("high" as const)
          : ("standard" as const),
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
    stages: stagesData,
    actions,
    throughput: ops.trend.map((row) => ({
      label: row.month,
      created: row.created,
      completed: row.completed,
    })),
  };
}
