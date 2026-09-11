import { ClipboardCheck, FileCheck2, ListChecks, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type QaReviewTab = "checks" | "documents" | "field" | "decision";
export function QaReviewTabs({
  value,
  onChange,
  checks,
  documents,
  fieldVisits,
  checked,
  checklistTotal,
  disabled,
}: {
  value: QaReviewTab;
  onChange: (value: QaReviewTab) => void;
  checks: number;
  documents: number;
  fieldVisits: number;
  checked: number;
  checklistTotal: number;
  disabled: boolean;
}) {
  const tabs = [
    {
      id: "checks",
      label: "Checks & findings",
      icon: ListChecks,
      count: String(checks),
      tone: "bg-mint-soft text-mint-deep border-mint/25",
    },
    {
      id: "documents",
      label: "Documents",
      icon: FileCheck2,
      count: String(documents),
      tone: "bg-info-soft text-info-foreground border-info/25",
    },
    ...(fieldVisits
      ? [
          {
            id: "field",
            label: "Field evidence",
            icon: MapPin,
            count: String(fieldVisits),
            tone: "bg-warning-soft text-warning-foreground border-warning/25",
          },
        ]
      : []),
    {
      id: "decision",
      label: "Quality & decision",
      icon: ClipboardCheck,
      count: `${checked}/${checklistTotal}`,
      tone: "bg-review-soft text-review-foreground border-review/25",
    },
  ] as const;
  return (
    <nav
      aria-label="Case review sections"
      className={cn(
        "grid gap-2 border-y border-border/60 bg-background/40 p-3",
        fieldVisits ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 min-[420px]:grid-cols-3",
      )}
    >
      {tabs.map(({ id, label, icon: Icon, count, tone }) => (
        <button
          type="button"
          key={id}
          aria-pressed={value === id}
          aria-controls="qa-review-content"
          disabled={disabled}
          onClick={() => onChange(id as QaReviewTab)}
          className={cn(
            "flex min-w-0 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
            value === id
              ? `${tone} shadow-sm ring-1 ring-current/20 font-semibold`
              : `${tone} hover:brightness-[0.98]`,
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span>{label}</span>
          <span className="num rounded-full bg-white/80 px-1.5 py-0.5 text-[10px]">{count}</span>
        </button>
      ))}
    </nav>
  );
}
