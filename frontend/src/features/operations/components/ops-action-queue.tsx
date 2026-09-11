"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { OpsActionItem, OpsActionTreatment } from "../contracts/operations";
import { OPS_STAGE_META } from "../contracts/case";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/formatting";
import type { StatusTone } from "@/lib/contracts/common";
import { cn } from "@/lib/utils";

const TREATMENT_TONE: Record<OpsActionTreatment, StatusTone> = {
  critical: "critical",
  action: "warning",
  processing: "info",
  review: "review",
  resolved: "success",
};

const TREATMENT_LABEL: Record<OpsActionTreatment, string> = {
  critical: "Act now",
  action: "Needs action",
  processing: "In progress",
  review: "Review",
  resolved: "Ready",
};

const PAGE_SIZE = 6;

interface OpsActionQueueProps {
  items: readonly OpsActionItem[];
  onOpenCase: (caseId: string) => void;
}

export function OpsActionQueue({ items, onOpenCase }: OpsActionQueueProps) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = useMemo(
    () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [items, safePage],
  );

  return (
    <Section
      title="SLA attention"
      description="Delivery risks and ownership gaps, most urgent first."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {visible.map((item) => {
          const tone = TREATMENT_TONE[item.treatment];
          return (
            <li key={item.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
              <span
                aria-hidden
                className={cn(
                  "mt-1 h-9 w-[3px] shrink-0 rounded-full",
                  tone === "critical"
                    ? "bg-critical"
                    : tone === "warning"
                      ? "bg-warning"
                      : tone === "review"
                        ? "bg-review"
                        : tone === "success"
                          ? "bg-success"
                          : "bg-info",
                )}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-xs text-muted-foreground">{item.caseNumber}</span>
                  <span className="text-[13px] font-medium text-foreground">
                    {item.candidateName}
                  </span>
                  <StatusBadge label={TREATMENT_LABEL[item.treatment]} tone={tone} />
                  <StatusBadge
                    label={OPS_STAGE_META[item.stage].short}
                    tone="neutral"
                    withDot={false}
                  />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.issue}</p>
                <p className="text-[11px] text-muted-foreground/85">
                  {item.clientName} · waiting {formatDuration(item.waitingMinutes)} · owner{" "}
                  {item.owner}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="num hidden text-[11px] text-muted-foreground sm:block">
                  {item.slaMinutesRemaining <= 0
                    ? `Overdue ${formatDuration(-item.slaMinutesRemaining)}`
                    : `${formatDuration(item.slaMinutesRemaining)} left`}
                </span>
                <Button variant="outline" size="sm" onClick={() => onOpenCase(item.caseId)}>
                  {item.nextAction}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <PaginationBar
        page={safePage}
        pageSize={PAGE_SIZE}
        total={items.length}
        onPageChange={setPage}
        label="actions"
      />
    </Section>
  );
}
