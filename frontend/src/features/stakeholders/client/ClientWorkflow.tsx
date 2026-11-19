import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DOT, type Tone } from "@/kit";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { cn } from "@/lib/utils";
import { clientStages } from "./client-queue-model";

const groups: Array<{ label: string; tone: Tone; statuses: string[] }> = [
  { label: "Awaiting candidate", tone: "neutral", statuses: ["DRAFT", "CONSENT_PENDING"] },
  {
    label: "Document review",
    tone: "warn",
    statuses: ["DOCUMENT_PENDING", "CLARIFICATION_PENDING"],
  },
  { label: "Verification", tone: "brand", statuses: ["IN_PROGRESS"] },
  { label: "Quality review", tone: "note", statuses: ["QA_REVIEW", "MANAGER_REVIEW"] },
  { label: "Report release", tone: "good", statuses: ["REPORT_PENDING", "PAYMENT_PENDING"] },
];

/** One bar of the active cases by stage (Task "Work by status"); a stage filters the list. */
export function ClientWorkflow({
  data,
  selected,
  onSelect,
}: {
  data: OperationsDashboard;
  selected?: string;
  onSelect: (status?: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const counted = groups.map((group) => ({
    ...group,
    count: group.statuses.reduce((sum, status) => sum + (data.statusMix[status] ?? 0), 0),
  }));
  const total = counted.reduce((sum, group) => sum + group.count, 0);
  const chip = (active: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-dim hover:bg-subtle hover:text-ink",
      active && "bg-brand-soft text-ink",
    );
  return (
    <section
      aria-label="Verification flow"
      className="rounded-lg border border-line bg-surface shadow-soft px-4 py-3"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Where your active cases are</h2>
        <span className="font-mono text-xs text-dim">{total} active</span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
        {total
          ? counted.map((group) =>
              group.count ? (
                <div
                  key={group.label}
                  className={cn("h-full", DOT[group.tone])}
                  style={{ width: `${(group.count / total) * 100}%` }}
                />
              ) : null,
            )
          : null}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
        {counted.map((group) => {
          const active = Boolean(selected && group.statuses.includes(selected));
          const content = (
            <>
              <span className={cn("size-2 rounded-full", DOT[group.tone])} aria-hidden />
              {group.label}
              <b className="font-mono font-semibold text-ink">{group.count}</b>
            </>
          );
          return (
            <li key={group.label}>
              {group.statuses.length === 1 ? (
                <button
                  type="button"
                  aria-pressed={active}
                  className={chip(active)}
                  onClick={() =>
                    onSelect(selected === group.statuses[0] ? undefined : group.statuses[0])
                  }
                >
                  {content}
                </button>
              ) : (
                <Popover
                  open={open === group.label}
                  onOpenChange={(value) => setOpen(value ? group.label : null)}
                >
                  <PopoverTrigger asChild>
                    <button type="button" aria-pressed={active} className={chip(active)}>
                      {content}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2">
                    <p className="px-2 py-2 text-xs text-dim">
                      Choose a stage in {group.label.toLowerCase()}
                    </p>
                    {group.statuses.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="flex min-h-10 w-full items-center justify-between rounded-md px-2 text-sm text-ink hover:bg-brand-soft"
                        onClick={() => {
                          onSelect(selected === status ? undefined : status);
                          setOpen(null);
                        }}
                      >
                        {clientStages.find((stage) => stage.value === status)?.label}
                        <strong className="font-mono">{data.statusMix[status] ?? 0}</strong>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-dim">Select a stage to view matching cases.</p>
    </section>
  );
}
