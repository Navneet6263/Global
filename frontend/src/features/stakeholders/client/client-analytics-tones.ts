export type ClientAnalyticsTone = "mint" | "amber" | "rose" | "blue" | "violet";

export const clientAnalyticsTones: Record<
  ClientAnalyticsTone,
  { wash: string; icon: string; bar: string; pill: string }
> = {
  mint: {
    wash: "border-mint/25 bg-gradient-to-br from-mint-soft/90 via-card to-card",
    icon: "bg-mint-soft text-mint-deep ring-mint/20",
    bar: "bg-mint-deep",
    pill: "bg-mint-soft text-mint-deep",
  },
  amber: {
    wash: "border-warning/25 bg-gradient-to-br from-warning-soft/85 via-card to-card",
    icon: "bg-warning-soft text-warning-foreground ring-warning/20",
    bar: "bg-warning",
    pill: "bg-warning-soft text-warning-foreground",
  },
  rose: {
    wash: "border-critical/20 bg-gradient-to-br from-critical-soft/80 via-card to-card",
    icon: "bg-critical-soft text-critical-foreground ring-critical/20",
    bar: "bg-critical",
    pill: "bg-critical-soft text-critical-foreground",
  },
  blue: {
    wash: "border-info/20 bg-gradient-to-br from-info-soft/80 via-card to-card",
    icon: "bg-info-soft text-info-foreground ring-info/20",
    bar: "bg-info",
    pill: "bg-info-soft text-info-foreground",
  },
  violet: {
    wash: "border-review/20 bg-gradient-to-br from-review-soft/80 via-card to-card",
    icon: "bg-review-soft text-review-foreground ring-review/20",
    bar: "bg-review",
    pill: "bg-review-soft text-review-foreground",
  },
};
