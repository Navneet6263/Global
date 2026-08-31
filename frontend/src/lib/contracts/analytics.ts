export interface TrendPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface DistributionSlice {
  label: string;
  value: number;
  tone: "success" | "info" | "warning" | "critical" | "review" | "neutral";
}

export interface PerformanceRow {
  id: string;
  name: string;
  volume: number;
  performanceRate: number | null;
  averageTurnaroundHours: number | null;
  exceptionRate: number;
}

export interface CapacityRow {
  id: string;
  owner: string;
  openLoad: number;
  completed: number;
  overdue: number;
  relativeLoad: number;
}

export interface ForecastSummary {
  dueNext7Days: number;
  atRiskNext7Days: number;
  projectedCompletions7Days: number;
  unassignedActive: number;
}

export interface ExecutiveAnalytics {
  portfolioTrend: readonly TrendPoint[];
  slaTrend: readonly TrendPoint[];
  turnaroundTrend: readonly TrendPoint[];
  riskDistribution: readonly DistributionSlice[];
  clientPerformance: readonly PerformanceRow[];
  branchPerformance: readonly PerformanceRow[];
  checkPerformance: readonly PerformanceRow[];
  capacity: readonly CapacityRow[];
  forecast: ForecastSummary;
}

export interface AnalyticsQuery {
  clientId?: string | "all";
  window?: "7d" | "30d" | "90d";
}
