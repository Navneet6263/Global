import { StatusBadge } from "@/components/feedback/status-badge";
import {
  OversightEmpty,
  OversightPanel,
  OversightPill,
} from "@/features/admin-dashboard/components/oversight-ui";
import type { SpocAttentionItem } from "../contracts/spoc";
import { HOLDER_LABEL, statusTone } from "../config/spoc-meta";
import { age, label } from "../utils/spoc-format";

const severityTone = { 3: "rose", 2: "amber", 1: "blue" } as const;

/** Top 12 live cases ranked by the existing attention rules (overdue, risk, urgency, open items). */
export function SpocAttentionQueue({
  items,
  onOpenCase,
}: {
  items: readonly SpocAttentionItem[];
  onOpenCase: (caseId: string) => void;
}) {
  return (
    <OversightPanel
      title="Highest-priority cases"
      description="Ranked by overdue SLA, risk, urgency, open clarifications and field exceptions."
      count={items.length}
    >
      {items.length ? (
        <ul className="divide-y divide-border/70">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenCase(item.id)}
                className="grid w-full gap-2 px-5 py-3 text-left transition hover:bg-mint-soft/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {item.subject.fullName}
                  </span>
                  <span className="num mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {item.caseNumber} · {item.client.displayName} · with{" "}
                    {HOLDER_LABEL[item.holderRole]}
                    {item.owner ? ` · ${item.owner.displayName}` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {item.reasons.map((reason) => (
                    <OversightPill
                      key={reason}
                      tone={severityTone[item.severity as 1 | 2 | 3] ?? "neutral"}
                    >
                      {reason}
                    </OversightPill>
                  ))}
                  <StatusBadge label={label(item.status)} tone={statusTone(item.status)} />
                  <span className="text-[10px] text-muted-foreground">
                    idle {age(item.ageHours)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <OversightEmpty
          title="Nothing urgent"
          detail="No live case is overdue, high-risk or blocked."
        />
      )}
    </OversightPanel>
  );
}
