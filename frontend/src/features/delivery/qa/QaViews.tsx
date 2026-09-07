import { CheckCheck, History, Inbox, RotateCcw, UserRoundCheck } from "lucide-react";
import type { QaRegisterView } from "@/lib/backend-api/qa-register";
import { cn } from "@/lib/utils";

export type QaWorkView = QaRegisterView | "history";
const views = [
  { id: "all", label: "Awaiting review", icon: Inbox },
  { id: "available", label: "Available to claim", icon: CheckCheck },
  { id: "mine", label: "My claims", icon: UserRoundCheck },
  { id: "corrections", label: "Corrections", icon: RotateCcw },
  { id: "history", label: "My decisions", icon: History },
] as const;

export function QaViews({
  value,
  onChange,
}: {
  value: QaWorkView;
  onChange: (value: QaWorkView) => void;
}) {
  return (
    <nav
      aria-label="Quality review views"
      className="flex flex-wrap gap-2 rounded-3xl border border-white/80 bg-white/75 p-2 shadow-[var(--shadow-card)]"
    >
      {views.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={value === id ? "page" : undefined}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            value === id
              ? "bg-mint-deep text-white shadow-sm"
              : "text-muted-foreground hover:bg-mint-soft hover:text-mint-deep",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </nav>
  );
}
