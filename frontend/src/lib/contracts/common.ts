export type StatusTone = "success" | "info" | "warning" | "critical" | "review" | "neutral";

export type TrendDirection = "up" | "down" | "flat";

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Option {
  value: string;
  label: string;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface HealthComponent {
  id: string;
  label: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  detail: string;
  metric: string;
  checkedAt: string;
}
