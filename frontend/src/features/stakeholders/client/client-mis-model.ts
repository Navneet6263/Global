import { CircleHelp, GaugeCircle, ListChecks, TriangleAlert, type LucideIcon } from "lucide-react";
import type { MisFrequency, MisPreset } from "@/lib/backend-api/client-reports";

export const PRESETS: Array<{ value: MisPreset; label: string; hint: string; icon: LucideIcon }> = [
  {
    value: "CASE_STATUS",
    label: "Case status",
    hint: "Every case and where it is",
    icon: ListChecks,
  },
  { value: "TAT", label: "TAT", hint: "Turnaround and cases past due", icon: GaugeCircle },
  { value: "UTV", label: "UTV", hint: "Checks unable to verify", icon: CircleHelp },
  {
    value: "DISCREPANCY",
    label: "Discrepancy",
    hint: "Checks with a discrepancy",
    icon: TriangleAlert,
  },
];

export const FREQUENCIES: Array<{ value: MisFrequency; label: string }> = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly (Monday)" },
  { value: "MONTHLY", label: "Monthly (1st)" },
];

export const presetLabel = (value: MisPreset) =>
  PRESETS.find((item) => item.value === value)?.label;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
export const today = isoDay(new Date());
export const monthAgo = isoDay(new Date(Date.now() - 30 * 86_400_000));

/** Small uppercase label used above form groups (Task style). */
export const sectionLabel = "text-[11px] font-semibold tracking-wider text-dim uppercase";
/** Label wrapped around a form control. */
export const fieldLabel = "flex min-w-0 flex-col gap-1 text-xs font-medium text-dim";
