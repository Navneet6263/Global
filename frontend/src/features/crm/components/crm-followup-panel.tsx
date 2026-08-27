"use client";

import { Link } from "@tanstack/react-router";
import { AlarmClock, ArrowUpRight, CalendarClock, Check } from "lucide-react";
import type { FollowUp } from "../contracts/crm";
import { STAGE_LABEL, STAGE_TONE } from "../config/crm";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatInr } from "@/lib/formatting";

interface CrmFollowUpPanelProps {
  followUps: readonly FollowUp[];
  onComplete?: (followUp: FollowUp) => void;
  onReschedule?: (followUp: FollowUp) => void;
  onOpen?: (followUp: FollowUp) => void;
  limit?: number;
}

export function CrmFollowUpPanel({
  followUps,
  onComplete,
  onReschedule,
  onOpen,
  limit = 6,
}: CrmFollowUpPanelProps) {
  const rows = followUps.slice(0, limit);

  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
          Today&apos;s priorities
        </h2>
        <Link
          to="/sales-crm/follow-ups"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-mint-deep hover:underline"
        >
          Follow-up workbench
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-mint-soft/60 px-4 py-6 text-center text-sm text-muted-foreground">
          No pending follow-ups. Pipeline hygiene is clean.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const overdue = Date.parse(row.dueAt) < Date.now();
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-[1.15rem] border border-white/80 bg-white/70 px-3.5 py-3 shadow-[var(--shadow-card)]"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: overdue
                      ? "oklch(0.6 0.17 18 / 0.12)"
                      : "oklch(0.62 0.13 168 / 0.12)",
                    color: overdue ? "oklch(0.55 0.17 18)" : "oklch(0.5 0.12 168)",
                  }}
                >
                  {overdue ? (
                    <AlarmClock className="size-4" aria-hidden />
                  ) : (
                    <CalendarClock className="size-4" aria-hidden />
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onOpen?.(row)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {row.company}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {row.suggestedAction} · {formatDateTime(row.dueAt)}
                  </span>
                </button>
                <span className="num hidden text-[12px] font-medium text-foreground sm:block">
                  {formatInr(row.estimatedValue, { compact: true })}
                </span>
                <StatusBadge label={STAGE_LABEL[row.stage]} tone={STAGE_TONE[row.stage]} />
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => onReschedule?.(row)}>
                    Snooze
                  </Button>
                  <Button size="sm" onClick={() => onComplete?.(row)}>
                    <Check className="size-3.5" aria-hidden />
                    Done
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
