"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  ACTION_KIND_LABELS,
  ACTION_TREATMENT_META,
  type ActionItem,
} from "@/lib/contracts/dashboard";
import { PRIORITY_META } from "@/lib/contracts/case";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDuration } from "@/lib/formatting";

interface ActionQueueProps {
  items: readonly ActionItem[];
  onOpenCase: (caseId: string) => void;
}

const PAGE_SIZE = 5;

export function ActionQueue({ items, onOpenCase }: ActionQueueProps) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = useMemo(
    () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [items, safePage],
  );

  return (
    <Section
      title="Action queue"
      description="Cases blocked on a person or approaching a client commitment, most urgent first."
      padded={false}
    >
      {items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={ArrowRight}
            title="Nothing waiting on the platform team"
            description="Every open case is progressing inside its SLA window."
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {visible.map((item) => {
              const treatment = ACTION_TREATMENT_META[item.treatment];
              return (
                <li key={item.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={treatment.label} tone={treatment.tone} />
                      <StatusBadge
                        label={PRIORITY_META[item.severity].label}
                        tone={PRIORITY_META[item.severity].tone}
                        withDot={false}
                      />
                      <span className="text-[13px] font-medium text-foreground">
                        {item.candidateName}
                      </span>
                      <span className="num text-[11px] text-muted-foreground">
                        {item.caseNumber}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/85">
                      {ACTION_KIND_LABELS[item.kind]} — {item.reason}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.clientName} · waiting on {item.responsible} for{" "}
                      {formatDuration(item.waitingSinceMinutes)} · due {formatDateTime(item.dueAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
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
        </>
      )}
    </Section>
  );
}
