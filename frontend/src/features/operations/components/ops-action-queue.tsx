"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import type { OpsActionItem, OpsActionTreatment } from "../contracts/operations";
import { OPS_STAGE_META } from "../contracts/case";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { formatDuration } from "@/lib/formatting";
import { initials } from "../workspace/ops-queue-model";

const TREATMENT: Record<
  OpsActionTreatment,
  { label: string; tone: "bad" | "warn" | "info" | "good" }
> = {
  critical: { label: "Act now", tone: "bad" },
  action: { label: "Needs action", tone: "warn" },
  processing: { label: "In progress", tone: "info" },
  review: { label: "Review", tone: "info" },
  resolved: { label: "Ready", tone: "good" },
};

const PAGE_SIZE = 6;

interface OpsActionQueueProps {
  items: readonly OpsActionItem[];
  onOpenCase: (caseId: string) => void;
}

/** Delivery risks and ownership gaps, most urgent first. Collapses to one line when clear. */
export function OpsActionQueue({ items, onOpenCase }: OpsActionQueueProps) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = useMemo(
    () => items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [items, safePage],
  );
  const critical = items.filter((item) => item.treatment === "critical").length;
  return (
    <section className="attn-card" aria-label="SLA attention">
      <header className="attn-card-head">
        <div>
          <h2>SLA attention</h2>
          <p>
            Delivery risks and ownership gaps, most urgent first
            {critical ? ` · ${critical} to act on now` : ""}
          </p>
        </div>
      </header>
      {visible.length ? (
        <ul className="attn-rows mt-3" aria-label="Delivery risks">
          {visible.map((item) => {
            const treatment = TREATMENT[item.treatment];
            const overdue = item.slaMinutesRemaining <= 0;
            return (
              <li key={item.id} className={`attn-row ${overdue ? "is-overdue" : ""}`}>
                <span className="attn-avatar" aria-hidden>
                  {initials(item.candidateName)}
                </span>
                <span className="attn-row-who">
                  <strong>{item.candidateName}</strong>
                  <small>
                    {item.caseNumber} · {item.clientName}
                  </small>
                </span>
                <span className="attn-row-mid">
                  <span>
                    <i className={`attn-dot is-${treatment.tone}`} aria-hidden />
                    {treatment.label} · {OPS_STAGE_META[item.stage].short}
                  </span>
                  <small>
                    {item.issue} · owner {item.owner} · waiting{" "}
                    {formatDuration(item.waitingMinutes)}
                  </small>
                </span>
                <span className={`attn-row-due ${overdue ? "is-bad" : "is-warn"}`}>
                  {overdue
                    ? `Overdue ${formatDuration(-item.slaMinutesRemaining)}`
                    : `${formatDuration(item.slaMinutesRemaining)} left`}
                </span>
                <button type="button" className="attn-go" onClick={() => onOpenCase(item.caseId)}>
                  {item.nextAction}
                  <ChevronRight aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="attn-empty">
          <ShieldCheck aria-hidden /> No delivery risks right now.
        </p>
      )}
      {items.length > PAGE_SIZE ? (
        <div className="attn-foot">
          <PaginationBar
            page={safePage}
            pageSize={PAGE_SIZE}
            total={items.length}
            onPageChange={setPage}
            label="actions"
          />
        </div>
      ) : null}
    </section>
  );
}
