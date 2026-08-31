import { Check } from "lucide-react";

import type { CaseDetail } from "@/lib/api/cases";
import { caseStatusLabel, relativeTime } from "./client-portal-utils";

export function ClientCaseTimeline({ items }: { items: CaseDetail["statusHistory"] }) {
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <header className="border-b border-border px-4 py-3">
        <h3 className="text-xs font-semibold text-foreground">Progress timeline</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          A clear history of every case movement
        </p>
      </header>
      <div className="p-4">
        {[...items].reverse().map((event, index) => (
          <div
            key={`${event.createdAt}-${event.toStatus}`}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            {index < items.length - 1 ? (
              <span className="absolute left-3 top-6 h-full w-px bg-border" />
            ) : null}
            <span
              className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full ${index === 0 ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]" : "bg-muted text-muted-foreground"}`}
            >
              <Check className="h-3 w-3" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[11px] font-semibold text-foreground">
                {caseStatusLabel(event.toStatus)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {relativeTime(event.createdAt)}
                {event.reason ? ` · ${event.reason}` : ""}
              </p>
            </div>
          </div>
        ))}
        {!items.length ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Timeline will appear after the first workflow event.
          </p>
        ) : null}
      </div>
    </section>
  );
}
