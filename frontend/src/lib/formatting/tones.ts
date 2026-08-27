import type { StatusTone } from "@/lib/contracts/common";

export const TONE_BADGE: Record<StatusTone, string> = {
  success: "bg-success-soft text-success-foreground border-success/25",
  info: "bg-info-soft text-info-foreground border-info/25",
  warning: "bg-warning-soft text-warning-foreground border-warning/30",
  critical: "bg-critical-soft text-critical-foreground border-critical/25",
  review: "bg-review-soft text-review-foreground border-review/25",
  neutral: "bg-neutral-soft text-neutral-foreground border-border-strong",
};

export const TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  critical: "bg-critical",
  review: "bg-review",
  neutral: "bg-neutral",
};

export const TONE_TEXT: Record<StatusTone, string> = {
  success: "text-success-foreground",
  info: "text-info-foreground",
  warning: "text-warning-foreground",
  critical: "text-critical-foreground",
  review: "text-review-foreground",
  neutral: "text-muted-foreground",
};

export const TONE_STROKE: Record<StatusTone, string> = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  critical: "var(--critical)",
  review: "var(--review)",
  neutral: "var(--neutral)",
};

export const TONE_SURFACE: Record<StatusTone, string> = {
  success: "bg-success-soft/60 border-success/20",
  info: "bg-info-soft/60 border-info/20",
  warning: "bg-warning-soft/70 border-warning/25",
  critical: "bg-critical-soft/70 border-critical/25",
  review: "bg-review-soft/60 border-review/20",
  neutral: "bg-neutral-soft border-border",
};
