/** Shared colour tones for the workspace kit (Tailwind classes only). */
export type Tone = "info" | "action" | "bad" | "good" | "neutral" | "violet" | "warn";

export const ICON_TILE: Record<Tone, string> = {
  info: "bg-blue-50 text-blue-600",
  action: "bg-orange-50 text-orange-600",
  bad: "bg-red-50 text-red-600",
  good: "bg-emerald-50 text-emerald-600",
  neutral: "bg-slate-100 text-slate-600",
  violet: "bg-violet-50 text-violet-600",
  warn: "bg-amber-50 text-amber-600",
};

export const PILL: Record<Tone, string> = {
  info: "bg-blue-50 text-blue-700",
  action: "bg-orange-50 text-orange-700",
  bad: "bg-red-50 text-red-700",
  good: "bg-emerald-50 text-emerald-700",
  neutral: "bg-slate-100 text-slate-700",
  violet: "bg-violet-50 text-violet-700",
  warn: "bg-amber-50 text-amber-700",
};

export const BAR: Record<Tone, string> = {
  info: "bg-blue-500",
  action: "bg-orange-500",
  bad: "bg-red-500",
  good: "bg-emerald-500",
  neutral: "bg-slate-400",
  violet: "bg-violet-500",
  warn: "bg-amber-500",
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
