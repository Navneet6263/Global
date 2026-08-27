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
  slaAttainment: number;
  averageTurnaroundHours: number;
  discrepancyRate: number;
}

export interface CapacityRow {
  id: string;
  team: string;
  headcount: number;
  openLoad: number;
  capacity: number;
  utilisation: number;
}

export interface ForecastPoint {
  label: string;
  expectedIntake: number;
  expectedCompletions: number;
  slaRisk: number;
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
  forecast: readonly ForecastPoint[];
}

export interface AnalyticsQuery {
  clientId?: string | "all";
  window?: "7d" | "30d" | "90d";
}
