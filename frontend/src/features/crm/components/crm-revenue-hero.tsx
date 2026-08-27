import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarClock, Plus, Target } from "lucide-react";
import type { CrmMetric } from "../contracts/crm";
import { formatInr, formatPercent } from "@/lib/formatting";

const ACTIONS = [
  { label: "Pipeline", icon: Target, route: "/sales-crm/opportunities" as const },
  { label: "Follow-ups", icon: CalendarClock, route: "/sales-crm/follow-ups" as const },
  { label: "Forecast", icon: ArrowUpRight, route: "/sales-crm/forecast" as const },
];

interface CrmRevenueHeroProps {
  openPipeline: CrmMetric;
  closedWon?: CrmMetric;
  onCreate?: () => void;
}

export function CrmRevenueHero({ openPipeline, closedWon, onCreate }: CrmRevenueHeroProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
          Pipeline snapshot
        </h2>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-3 py-1.5 text-[11px] font-medium text-mint-deep transition-colors hover:bg-mint/15"
        >
          <Plus className="size-3.5" aria-hidden />
          Add deal
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div
          className="relative overflow-hidden rounded-[1.35rem] p-4 text-white/90 shadow-[var(--shadow-raise)]"
          style={{
            background: "linear-gradient(150deg, oklch(0.44 0.07 168), oklch(0.3 0.045 172) 70%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -right-10 size-32 rounded-full"
            style={{ background: "oklch(0.85 0.1 160 / 0.18)" }}
          />
          <p className="relative text-[10px] font-medium tracking-[0.14em] uppercase opacity-70">
            {openPipeline.label}
          </p>
          <p className="num relative mt-6 text-[2.1rem] leading-none font-medium tracking-[-0.04em]">
            {formatInr(openPipeline.value, { compact: true })}
          </p>
          <div className="relative mt-4 flex items-end justify-between gap-3">
            <span className="text-[11px] leading-tight opacity-70">
              Open deals
              <br />
              across all stages
            </span>
            <span className="num rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
              {openPipeline.deltaPercent > 0 ? "+" : ""}
              {formatPercent(openPipeline.deltaPercent)}
            </span>
          </div>
          <span
            aria-hidden
            className="absolute inset-x-4 bottom-0 h-1.5 rounded-t-full"
            style={{ background: "oklch(0.85 0.15 88 / 0.85)" }}
          />
        </div>

        <div className="space-y-3">
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            Where do you want to work?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ACTIONS.map((action) => (
              <Link
                key={action.label}
                to={action.route}
                className="group flex flex-col items-center gap-2 rounded-[1.1rem] bg-mint-soft/70 px-2 py-3 text-center transition-colors hover:bg-mint-soft"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-mint/12 text-mint-deep transition-transform group-hover:-translate-y-0.5">
                  <action.icon className="size-4" aria-hidden />
                </span>
                <span className="text-[11px] font-medium text-foreground">{action.label}</span>
              </Link>
            ))}
          </div>
          {closedWon ? (
            <div className="flex items-baseline justify-between gap-2 rounded-[1.1rem] border border-white/80 bg-white/70 px-3 py-2.5 shadow-[var(--shadow-card)]">
              <span className="text-[11px] text-muted-foreground">{closedWon.label}</span>
              <span className="num text-base font-medium text-foreground">
                {formatInr(closedWon.value, { compact: true })}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
