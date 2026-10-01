import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { clientStages } from "./client-queue-model";

const groups = [
  { label: "Awaiting candidate", color: "#bfdbfe", statuses: ["DRAFT", "CONSENT_PENDING"] },
  {
    label: "Document review",
    color: "#fde68a",
    statuses: ["DOCUMENT_PENDING", "CLARIFICATION_PENDING"],
  },
  { label: "Verification", color: "#bbf7d0", statuses: ["IN_PROGRESS"] },
  { label: "Quality review", color: "#ddd6fe", statuses: ["QA_REVIEW", "MANAGER_REVIEW"] },
  { label: "Report release", color: "#fecdd3", statuses: ["REPORT_PENDING", "PAYMENT_PENDING"] },
];

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
  return (
    <section className="client-panel client-stage-panel" aria-label="Verification flow">
      <header className="client-panel-head">
        <h2>
          Where your active cases are <small>({total})</small>
        </h2>
        <p>Select a stage to view matching cases.</p>
      </header>
      <div className="client-stage-bar" aria-hidden>
        {counted.map((group) => (
          <span
            key={group.label}
            style={{
              width: total ? `${(group.count / total) * 100}%` : "20%",
              background: total ? group.color : "#e2e8f0",
            }}
          />
        ))}
      </div>
      <div className="client-stage-legend">
        {counted.map((group) => (
          <Popover
            key={group.label}
            open={open === group.label}
            onOpenChange={(value) => setOpen(value ? group.label : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-pressed={Boolean(selected && group.statuses.includes(selected))}
                onClick={
                  group.statuses.length === 1
                    ? (event) => {
                        event.preventDefault();
                        onSelect(selected === group.statuses[0] ? undefined : group.statuses[0]);
                      }
                    : undefined
                }
              >
                <span>
                  <i style={{ background: group.color }} aria-hidden />
                  {group.label}
                </span>
                <strong className="num">{group.count}</strong>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Choose a stage in {group.label.toLowerCase()}
              </p>
              {group.statuses.map((status) => (
                <button
                  key={status}
                  className="flex min-h-10 w-full items-center justify-between rounded-md px-2 text-sm hover:bg-accent"
                  onClick={() => {
                    onSelect(selected === status ? undefined : status);
                    setOpen(null);
                  }}
                >
                  {clientStages.find((stage) => stage.value === status)?.label}
                  <strong>{data.statusMix[status] ?? 0}</strong>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ))}
      </div>
    </section>
  );
}
