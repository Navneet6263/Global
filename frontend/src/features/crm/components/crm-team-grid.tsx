import type { SalesOwner } from "../contracts/crm";
import { crmAccent } from "../accents";
import { formatInr, formatPercent, initialsOf } from "@/lib/formatting";
import { Button } from "@/components/ui/button";

interface CrmTeamGridProps {
  owners: readonly SalesOwner[];
  onViewPipeline: (owner: SalesOwner) => void;
}

export function CrmTeamGrid({ owners, onViewPipeline }: CrmTeamGridProps) {
  const maxPipeline = Math.max(...owners.map((owner) => owner.pipelineValue), 1);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {owners.map((owner) => {
        const accent = crmAccent(owner.overdueFollowUps > 2 ? "overdueFollowUps" : "openPipeline");
        const load = Math.round((owner.pipelineValue / maxPipeline) * 100);

        return (
          <article
            key={owner.id}
            className="rounded-[1.6rem] border border-white/80 bg-card/85 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm"
            style={{ borderTop: `2px solid ${accent.edge}` }}
          >
            <header className="flex items-center gap-3">
              <span
                className="flex size-10 items-center justify-center rounded-full text-[13px] font-semibold"
                style={{ background: accent.fill, color: accent.colour }}
              >
                {initialsOf(owner.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-foreground">{owner.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {owner.territory ?? "No branch scope"}
                </p>
              </div>
            </header>

            <dl className="mt-3 grid grid-cols-2 gap-2.5 text-[12px]">
              <Cell label="Pipeline" value={formatInr(owner.pipelineValue, { compact: true })} />
              <Cell label="Weighted" value={formatInr(owner.weightedForecast, { compact: true })} />
              <Cell label="Won" value={formatInr(owner.wonRevenue, { compact: true })} />
              <Cell label="Win rate" value={formatPercent(owner.winRate, 0)} />
              <Cell label="Open deals" value={String(owner.activeOpportunities)} />
              <Cell label="Closing this month" value={String(owner.closingThisMonth)} />
            </dl>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Relative load</span>
                <span className="num">{load}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full"
                style={{ background: "oklch(0.95 0.008 150)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${load}%`, background: accent.colour }}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span
                className="num rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: accent.fill, color: accent.colour }}
              >
                {owner.overdueFollowUps} overdue · {owner.activitiesThisWeek} activities
              </span>
              <Button size="sm" variant="ghost" onClick={() => onViewPipeline(owner)}>
                View pipeline
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2.5 py-2">
      <dt className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">{label}</dt>
      <dd className="num text-[13px] font-medium text-foreground">{value}</dd>
    </div>
  );
}
