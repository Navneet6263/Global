import type { NavBadgeTone } from "@/config/navigation";
import type { StatusTone } from "@/lib/contracts/common";

export const BADGE_TONE_MAP: Record<NavBadgeTone, StatusTone> = {
  info: "info",
  warning: "warning",
  critical: "critical",
  review: "review",
  neutral: "neutral",
};
