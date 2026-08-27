import type { AnalyticsRepository, DashboardRepository } from "../repositories";
import type { CaseStage } from "@/lib/contracts/case";
import type { ActionItem, PipelineStage, SummaryCard } from "@/lib/contracts/dashboard";
import type {
  DistributionSlice,
  ExecutiveAnalytics,
  PerformanceRow,
} from "@/lib/contracts/analytics";
import { apiRequest } from "@/lib/backend-api/client";
import { getExecutiveDashboard, getOperationsDashboard } from "@/lib/backend-api/dashboards";

const stageMap: Record<string, CaseStage> = {
  DRAFT: "intake",
  CONSENT_PENDING: "consent",
  DOCUMENT_PENDING: "documents",
  IN_PROGRESS: "verification",
  CLARIFICATION_PENDING: "clarification",
  QA_REVIEW: "qa",
  COMPLETED: "completed",
  CLOSED: "completed",
  CANCELLED: "completed",
};

function numberSeries(
  rows: Array<{ month: string; created: number; completed: number }>,
  key: "created" | "completed",
) {
  return rows.map((row) => ({ label: row.month, value: row[key] }));
}

function summaryCards(data: Awaited<ReturnType<typeof getExecutiveDashboard>>): SummaryCard[] {
  const active =
    data.summary.total - (data.statusMix["COMPLETED"] ?? 0) - (data.statusMix["CLOSED"] ?? 0);
  const completedMonth = data.performanceTrend.at(-1)?.created ?? 0;
  const trend = data.trend;
  return [
    {
      id: "portfolio",
      label: "Active portfolio",
      value: String(Math.max(0, active)),
      description: "Cases currently in flight",
      comparison: { label: "Current period", delta: 0, direction: "flat" },
      tone: "success",
      series: numberSeries(trend, "created"),
      target: { route: "/admin/cases" },
    },
    {
      id: "sla-health",
      label: "SLA health",
      value: `${data.performance.slaPercentage ?? 0}%`,
      description: "Completed within committed due date",
      comparison: { label: "Current period", delta: 0, direction: "flat" },
      tone: (data.performance.slaPercentage ?? 100) < 85 ? "warning" : "success",
      series: data.performanceTrend.map((row) => ({
        label: row.month,
        value: row.slaPercentage ?? 0,
      })),
      target: { route: "/admin/analytics" },
    },
    {
      id: "completion-time",
      label: "Average completion time",
      value: `${data.performance.averageTatHours}h`,
      description: "Turnaround across completed cases",
      comparison: { label: "Current period", delta: 0, direction: "flat" },
      tone: "info",
      series: data.performanceTrend.map((row) => ({
        label: row.month,
        value: row.averageTatHours ?? 0,
      })),
      target: { route: "/admin/analytics" },
    },
    {
      id: "client-action",
      label: "Client action required",
      value: String(data.summary.overdue),
      description: "Portfolio items requiring attention",
      comparison: { label: "Current period", delta: 0, direction: "flat" },
      tone: data.summary.overdue ? "warning" : "success",
      series: data.performanceTrend.map((row) => ({ label: row.month, value: row.overdue })),
      target: { route: "/admin/cases", search: { sla: "overdue" } },
    },
    {
      id: "completed-month",
      label: "Completed this month",
      value: String(data.performance.completedCases),
      description: "Closed verification cases",
      comparison: {
        label: "Current month",
        delta: completedMonth,
        direction: completedMonth > 0 ? "up" : "flat",
      },
      tone: "success",
      series: numberSeries(trend, "completed"),
      target: { route: "/admin/cases", search: { stage: "completed" } },
    },
    {
      id: "critical-exceptions",
      label: "Critical exceptions",
      value: String(data.attentionQueue.filter((row) => row.severity >= 3).length),
      description: "Items needing immediate intervention",
      comparison: { label: "Live queue", delta: 0, direction: "flat" },
      tone: "critical",
      series: data.performanceTrend.map((row) => ({ label: row.month, value: row.overdue })),
      target: { route: "/admin/cases" },
    },
  ];
}

function pipeline(data: Awaited<ReturnType<typeof getExecutiveDashboard>>): PipelineStage[] {
  const total = Math.max(1, data.summary.total);
  const grouped = new Map<CaseStage, number>();
  Object.entries(data.statusMix).forEach(([status, count]) => {
    const stage = stageMap[status] ?? "verification";
    grouped.set(stage, (grouped.get(stage) ?? 0) + count);
  });
  const stages: CaseStage[] = [
    "intake",
    "consent",
    "documents",
    "verification",
    "clarification",
    "qa",
    "completed",
  ];
  return stages.map((stage) => {
    const count = grouped.get(stage) ?? 0;
    return {
      stage,
      count,
      shareOfPortfolio: Math.round((count / total) * 100),
      mode:
        stage === "completed"
          ? "closed"
          : ["consent", "documents", "clarification"].includes(stage)
            ? "waiting"
            : "processing",
      averageAgeMinutes: 0,
      slaRiskCount: stage === "completed" ? 0 : Math.min(count, data.summary.overdue),
      isBottleneck: count === Math.max(...Array.from(grouped.values()), 0),
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
    const data = await getExecutiveDashboard({ months: 12 });
    return {
      generatedAt: data.generatedAt,
      summary: summaryCards(data),
      pipeline: pipeline(data),
      actions: actions(data),
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
    slaAttainment: row.slaPercentage ?? 0,
    averageTurnaroundHours: row.averageTatHours ?? 0,
    discrepancyRate: row.total ? Math.round((row.overdue / row.total) * 100) : 0,
  }));
}

const riskTones: DistributionSlice["tone"][] = ["success", "warning", "critical", "neutral"];

export const analyticsRepository: AnalyticsRepository = {
  async getExecutive(query): Promise<ExecutiveAnalytics> {
    const months = query.window === "7d" ? 1 : query.window === "90d" ? 3 : 1;
    const data = await getExecutiveDashboard({
      months,
      clientId: query.clientId === "all" ? undefined : query.clientId,
    });
    return {
      portfolioTrend: data.trend.map((row) => ({
        label: row.month,
        value: row.created,
        secondary: row.completed,
      })),
      slaTrend: data.performanceTrend.map((row) => ({
        label: row.month,
        value: row.slaPercentage ?? 0,
      })),
      turnaroundTrend: data.performanceTrend.map((row) => ({
        label: row.month,
        value: row.averageTatHours ?? 0,
      })),
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
        slaAttainment: row.total ? Math.round((row.completed / row.total) * 100) : 0,
        averageTurnaroundHours: row.averageTatHours ?? 0,
        discrepancyRate: row.total ? Math.round((row.discrepancies / row.total) * 100) : 0,
      })),
      capacity: data.teamCapacity.map((row) => ({
        id: row.id,
        team: row.name,
        headcount: 1,
        openLoad: row.active,
        capacity: Math.max(row.active + row.completed, 1),
        utilisation: Math.min(
          100,
          Math.round((row.active / Math.max(row.active + row.completed, 1)) * 100),
        ),
      })),
      forecast: data.performanceTrend.map((row) => ({
        label: row.month,
        expectedIntake: row.created,
        expectedCompletions: Math.max(0, row.created - row.overdue),
        slaRisk: row.overdue,
      })),
    };
  },
};
