import { ClipboardCheck, FileCheck2, FileText, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type QaReviewTab = "report" | "documents" | "field" | "decision";

/** Section tabs of the QA review: report first, decision last. */
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
    { id: "report", label: "Report", icon: FileText, count: String(checks) },
    { id: "documents", label: "Documents", icon: FileCheck2, count: String(documents) },
    ...(fieldVisits
      ? [{ id: "field", label: "Field evidence", icon: MapPin, count: String(fieldVisits) }]
      : []),
    {
      id: "decision",
      label: "Decision",
      icon: ClipboardCheck,
      count: `${checked}/${checklistTotal}`,
    },
  ] as const;
  return (
    <nav
      aria-label="Case review sections"
      className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3"
    >
      {tabs.map(({ id, label, icon: Icon, count }) => {
        const active = value === id;
        return (
          <button
            type="button"
            key={id}
            aria-pressed={active}
            aria-controls="qa-review-content"
            disabled={disabled}
            onClick={() => onChange(id as QaReviewTab)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 disabled:opacity-50",
              active ? "text-slate-900" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{label}</span>
            <span
              className={cn(
                "num rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500",
              )}
            >
              {count}
            </span>
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
