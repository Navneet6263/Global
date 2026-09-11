import type { AnalyticsRepository, DashboardRepository } from "../repositories";
import { dashboardStageMap as stageMap } from "./dashboard-stage-map";
import type { CaseStage } from "@/lib/contracts/case";
import type { ActionItem, PipelineStage, SummaryCard } from "@/lib/contracts/dashboard";
import type {
  DistributionSlice,
  ExecutiveAnalytics,
  PerformanceRow,
} from "@/lib/contracts/analytics";
import { apiRequest } from "@/lib/backend-api/client";
import {
  getExceptionsDashboard,
  getExecutiveDashboard,
  getOperationsDashboard,
  type ExceptionsDashboard,
  type OperationsDashboard,
} from "@/lib/backend-api/dashboards";

function numberSeries(
  rows: Array<{ month: string; created: number; completed: number }>,
  key: "created" | "completed",
) {
  return rows.map((row) => ({ label: row.month, value: row[key] }));
}

function summaryCards(
  data: Awaited<ReturnType<typeof getExecutiveDashboard>>,
  operations: OperationsDashboard,
  exceptions: ExceptionsDashboard,
): SummaryCard[] {
  const active =
    operations.summary.total -
    (operations.statusMix["COMPLETED"] ?? 0) -
    (operations.statusMix["CLOSED"] ?? 0) -
    (operations.statusMix["CANCELLED"] ?? 0);
  return [
    {
      id: "portfolio",
      label: "Active portfolio",
      value: String(Math.max(0, active)),
      description: "All non-terminal cases currently in flight",
      tone: "success",
      series: numberSeries(operations.trend, "created"),
      target: { route: "/admin/cases" },
    },
    {
      id: "sla-health",
      label: "SLA health",
      value: data.performance.slaPercentage === null ? "—" : `${data.performance.slaPercentage}%`,
      description: "Completion SLA for cases initiated in the last 12 months",
      tone: (data.performance.slaPercentage ?? 100) < 85 ? "warning" : "success",
      series: data.performanceTrend.flatMap((row) =>
        row.slaPercentage === null ? [] : [{ label: row.month, value: row.slaPercentage }],
      ),
      target: { route: "/admin/analytics" },
    },
    {
      id: "completion-time",
      label: "Average completion time",
      value:
        data.performance.averageTatHours === null ? "—" : `${data.performance.averageTatHours}h`,
      description: "Turnaround for cases initiated in the last 12 months",
      tone: "info",
      series: data.performanceTrend.flatMap((row) =>
        row.averageTatHours === null ? [] : [{ label: row.month, value: row.averageTatHours }],
      ),
      target: { route: "/admin/analytics" },
    },
    {
      id: "client-action",
      label: "Client action required",
      value: String(exceptions.summary.clientActions),
      description: "Open clarifications and rejected documents",
      tone: exceptions.summary.clientActions ? "warning" : "success",
      series: [{ label: "Live", value: exceptions.summary.clientActions }],
      target: { route: "/admin/client-portal" },
    },
    {
      id: "completed-month",
      label: "Completed today",
      value: String(operations.summary.completedToday),
      description: "Cases completed since local day start",
      tone: "success",
      series: numberSeries(operations.trend, "completed"),
      target: { route: "/admin/cases", search: { stage: "completed" } },
    },
    {
      id: "critical-exceptions",
      label: "Critical exceptions",
      value: String(exceptions.summary.critical),
      description: "Urgent overdue cases and field exceptions",
      tone: "critical",
      series: [{ label: "Live", value: exceptions.summary.critical }],
      target: { route: "/admin/exceptions" },
    },
  ];
}

function pipeline(operations: OperationsDashboard): PipelineStage[] {
  const grouped = new Map<CaseStage, { count: number; oldestHours: number; atRisk: number }>();
  (operations.stageHealth ?? []).forEach((row) => {
    if (row.status === "CANCELLED") return;
    const stage = stageMap[row.status] ?? "verification";
    const current = grouped.get(stage) ?? { count: 0, oldestHours: 0, atRisk: 0 };
    grouped.set(stage, {
      count: current.count + row.count,
      oldestHours: Math.max(current.oldestHours, row.oldestAgeHours),
      atRisk: current.atRisk + row.atRisk,
    });
  });
  Object.entries(operations.statusMix).forEach(([status, count]) => {
    if (status === "CANCELLED" || operations.stageHealth?.some((row) => row.status === status)) {
      return;
    }
    const stage = stageMap[status] ?? "verification";
    const current = grouped.get(stage) ?? { count: 0, oldestHours: 0, atRisk: 0 };
    grouped.set(stage, { ...current, count: current.count + count });
  });
  const stages: CaseStage[] = [
    "intake",
    "consent",
    "documents",
    "verification",
    "clarification",
    "qa",
    "manager_review",
    "report_pending",
    "payment_pending",
    "completed",
  ];
  const total = Math.max(
    1,
    [...grouped.values()].reduce((sum, item) => sum + item.count, 0),
  );
  const bottleneck = stages
    .filter((stage) => stage !== "completed")
    .sort(
      (left, right) =>
        (grouped.get(right)?.oldestHours ?? 0) - (grouped.get(left)?.oldestHours ?? 0),
    )[0];
  return stages.map((stage) => {
    const health = grouped.get(stage) ?? { count: 0, oldestHours: 0, atRisk: 0 };
    return {
      stage,
      count: health.count,
      shareOfPortfolio: Math.round((health.count / total) * 100),
      mode:
        stage === "completed"
          ? "closed"
          : ["consent", "documents", "clarification", "manager_review", "payment_pending"].includes(
                stage,
              )
            ? "waiting"
            : "processing",
      oldestAgeMinutes: Math.round(health.oldestHours * 60),
      slaRiskCount: stage === "completed" ? 0 : health.atRisk,
      isBottleneck: stage === bottleneck && health.count > 0 && health.oldestHours > 0,
    };
  });
}

function actions(data: Awaited<ReturnType<typeof getExecutiveDashboard>>): ActionItem[] {
  return data.attentionQueue.map((row) => ({
    id: row.id,
    kind: row.reasons.some((reason) => reason.toLowerCase().includes("overdue"))
      ? "sla_overdue"
      : "sla_approaching",
    treatment: row.severity >= 3 ? "critical_overdue" : "sla_risk",
    candidateName: row.subject.fullName,
    caseNumber: row.caseNumber,
    caseId: row.id,
    clientName: row.client.displayName,
    reason: row.reasons.join(" · "),
    responsible: row.owner?.displayName ?? "Unassigned",
    waitingSinceMinutes: Math.round(row.ageHours * 60),
    dueAt: row.dueAt ?? row.updatedAt,
    severity: row.severity >= 3 ? "critical" : row.severity >= 2 ? "high" : "standard",
    nextAction: row.owner ? "Review case" : "Assign owner",
  }));
}

export const dashboardRepository: DashboardRepository = {
  async getControlTower() {
    const [data, operations, exceptions] = await Promise.all([
      getExecutiveDashboard({ months: 12 }),
      getOperationsDashboard(),
      getExceptionsDashboard(),
    ]);
    return {
      generatedAt: data.generatedAt,
      summary: summaryCards(data, operations, exceptions),
      pipeline: pipeline(operations),
      actions: actions(data),
      business: { finance: data.businessHealth.finance, outcomes: data.outcomeMix },
    };
  },
  async getPlatformHealth() {
    const health = await apiRequest<{ status: string; database: string; timestamp: string }>(
      "/health/ready",
    );
    return [
      {
        id: "api",
        label: "Application API",
        status: health.status === "ready" ? "healthy" : "degraded",
        detail: "NestJS application is responding",
        metric: health.status,
        checkedAt: health.timestamp,
      },
      {
        id: "database",
        label: "SQL Server",
        status: health.database === "up" ? "healthy" : "down",
        detail: "Primary application database",
        metric: health.database,
        checkedAt: health.timestamp,
      },
    ];
  },
};

function performance(
  rows: Array<{
    id: string;
    name: string;
    total: number;
    slaPercentage: number | null;
    averageTatHours: number | null;
    overdue: number;
  }>,
): PerformanceRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    volume: row.total,
    performanceRate: row.slaPercentage,
    averageTurnaroundHours: row.averageTatHours,
    exceptionRate: row.total ? Math.round((row.overdue / row.total) * 100) : 0,
  }));
}

const riskTones: DistributionSlice["tone"][] = ["success", "warning", "critical", "neutral"];

export const analyticsRepository: AnalyticsRepository = {
  async getExecutive(query): Promise<ExecutiveAnalytics> {
    const days = query.window === "7d" ? 7 : query.window === "90d" ? 90 : 30;
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    const data = await getExecutiveDashboard({
      months: Math.max(3, Math.ceil(days / 30)),
      from: from.toISOString(),
      to: to.toISOString(),
      clientId: query.clientId === "all" ? undefined : query.clientId,
    });
    return {
      portfolioTrend: data.trend.map((row) => ({
        label: row.month,
        value: row.created,
        secondary: row.completed,
      })),
      slaTrend: data.performanceTrend.flatMap((row) =>
        row.slaPercentage === null ? [] : [{ label: row.month, value: row.slaPercentage }],
      ),
      turnaroundTrend: data.performanceTrend.flatMap((row) =>
        row.averageTatHours === null ? [] : [{ label: row.month, value: row.averageTatHours }],
      ),
      riskDistribution: Object.entries(data.riskMix).map(([label, value], index) => ({
        label,
        value,
        tone: riskTones[index % riskTones.length] ?? "neutral",
      })),
      clientPerformance: performance(data.clientPerformance),
      branchPerformance: performance(data.branchPerformance),
      checkPerformance: data.checkPerformance.map((row) => ({
        id: row.type,
        name: row.type,
        volume: row.total,
        performanceRate: row.total ? Math.round((row.completed / row.total) * 100) : null,
        averageTurnaroundHours: row.averageTatHours,
        exceptionRate: row.total ? Math.round((row.discrepancies / row.total) * 100) : 0,
      })),
      capacity: data.teamCapacity.map((row, _index, rows) => ({
        id: row.id,
        owner: row.name,
        openLoad: row.active,
        completed: row.completed,
        overdue: row.overdue,
        relativeLoad: Math.round(
          (row.active / Math.max(...rows.map((member) => member.active), 1)) * 100,
        ),
      })),
      forecast: data.forecast,
    };
  },
};
