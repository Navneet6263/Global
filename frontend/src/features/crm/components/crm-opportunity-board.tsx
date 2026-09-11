"use client";

import { Link2, MoveRight } from "lucide-react";
import type { CrmStage, Opportunity } from "../contracts/crm";
import { CRM_STAGES, STAGE_LABEL } from "../config/crm";
import { STAGE_ACCENT_KEYS, crmAccent } from "../accents";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/formatting";

interface CrmOpportunityBoardProps {
  rows: readonly Opportunity[];
  onOpen: (opportunity: Opportunity) => void;
  onAdvance: (opportunity: Opportunity, stage: CrmStage) => void;
  canWrite: boolean;
  changingId?: string;
}

function nextStage(stage: CrmStage): CrmStage | null {
  const index = CRM_STAGES.indexOf(stage);
  const next = CRM_STAGES[index + 1];
  return next && next !== "LOST" ? next : null;
}

export function CrmOpportunityBoard({
  rows,
  onOpen,
  onAdvance,
  canWrite,
  changingId,
}: CrmOpportunityBoardProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {CRM_STAGES.map((stage, index) => {
        const accent = crmAccent(STAGE_ACCENT_KEYS[index % STAGE_ACCENT_KEYS.length]!);
        const items = rows.filter((row) => row.stage === stage);
        const value = items.reduce((sum, row) => sum + row.estimatedValue, 0);

        return (
          <section
            key={stage}
            className="flex min-h-[220px] flex-col gap-2.5 rounded-[1.4rem] border border-white/80 bg-card/70 p-3 shadow-[var(--shadow-card)] backdrop-blur-sm"
            style={{ borderTop: `2px solid ${accent.edge}` }}
          >
            <header className="space-y-0.5">
              <p className="flex items-center justify-between text-[12px] font-semibold text-foreground">
                {STAGE_LABEL[stage]}
                <span
                  className="num rounded-full px-2 py-0.5 text-[11px]"
                  style={{ background: accent.fill, color: accent.colour }}
                >
                  {items.length}
                </span>
              </p>
              <p className="num text-[11px] text-muted-foreground">
                {formatInr(value, { compact: true })}
              </p>
            </header>

            <div className="space-y-2">
              {items.map((row) => {
                const advance = nextStage(row.stage);
                return (
                  <article
                    key={row.id}
                    className="rounded-[1.05rem] border border-white/80 bg-white/80 p-2.5 shadow-[var(--shadow-card)]"
                  >
                    <button type="button" onClick={() => onOpen(row)} className="w-full text-left">
                      <span className="block truncate text-[12.5px] font-medium text-foreground">
                        {row.company}
                      </span>
                      <span className="num block text-[11px] text-muted-foreground">
                        {formatInr(row.estimatedValue, { compact: true })} · {row.probability}%
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {row.ownerName ?? "Unassigned"}
                      </span>
                    </button>
                    {canWrite && advance ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-1.5 h-7 w-full justify-between px-2 text-[11px]"
                        onClick={() => onAdvance(row, advance)}
                        loading={changingId === row.id}
                        disabled={!!changingId}
                      >
                        Move to {STAGE_LABEL[advance]}
                        <MoveRight className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </article>
                );
              })}
              {items.length === 0 ? (
                <p className="flex items-center gap-1.5 rounded-[1.05rem] bg-mint-soft/50 px-2.5 py-3 text-[11px] text-muted-foreground">
                  <Link2 className="size-3.5" aria-hidden />
                  Nothing here yet
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
