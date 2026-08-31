import { ArrowRight, Clock3 } from "lucide-react";

import { Section } from "@/components/layout/section";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { caseStatusLabel, relativeTime, statusTone } from "./client-portal-utils";

export function ClientRecentCases({
  items,
  onOpen,
}: {
  items: OperationsDashboard["recentCases"];
  onOpen: (caseId: string) => void;
}) {
  return (
    <Section
      title="Recent movement"
      description="Latest portfolio updates, ordered by the most recent workflow event"
      padded={false}
    >
      <div className="divide-y divide-border/70">
        {items.slice(0, 6).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.id)}
            className="group grid w-full gap-3 px-5 py-4 text-left transition hover:bg-mint-soft/35 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_auto] sm:items-center"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                {item.subject.fullName}
              </span>
              <span className="num mt-0.5 block text-[10px] text-muted-foreground">
                {item.caseNumber}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${statusTone(item.status)}`}
              >
                {caseStatusLabel(item.status)}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock3 className="size-3" aria-hidden /> {relativeTime(item.updatedAt)}
              </span>
            </span>
            <ArrowRight className="hidden size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
          </button>
        ))}
        {!items.length ? (
          <p className="px-5 py-12 text-center text-xs text-muted-foreground">
            New verification activity will appear here.
          </p>
        ) : null}
      </div>
    </Section>
  );
}
