import { Link } from "@tanstack/react-router";
import { ArrowUpRight, FileBarChart, Layers, TriangleAlert } from "lucide-react";
import type { SummaryCard as SummaryCardData } from "@/lib/contracts/dashboard";

const ACTIONS = [
  { label: "Register", icon: Layers, route: "/admin/cases" as const },
  { label: "Exceptions", icon: TriangleAlert, route: "/admin/cases" as const },
  { label: "Reports", icon: FileBarChart, route: "/admin/analytics" as const },
];

interface PortfolioCardProps {
  portfolio: SummaryCardData;
  completion?: SummaryCardData;
}

export function PortfolioCard({ portfolio, completion }: PortfolioCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
          Portfolio
        </h2>
        <Link
          to="/admin/cases"
          className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-3 py-1.5 text-[11px] font-medium text-mint-deep transition-colors hover:bg-mint/15"
        >
          Open register
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* portfolio "card" tile, deep mint like a physical card */}
        <div
          className="relative overflow-hidden rounded-[1.35rem] p-4 text-white/90 shadow-[var(--shadow-raise)]"
          style={{
            background: "linear-gradient(150deg, oklch(0.44 0.07 168), oklch(0.3 0.045 172) 70%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full"
            style={{ background: "oklch(0.85 0.1 160 / 0.18)" }}
          />
          <p className="relative text-[10px] font-medium tracking-[0.14em] uppercase opacity-70">
            Active portfolio
          </p>
          <p className="num relative mt-6 text-[2.4rem] leading-none font-medium tracking-[-0.04em]">
            {portfolio.value}
          </p>
          <div className="relative mt-4 flex items-end justify-between gap-3">
            <span className="text-[11px] leading-tight opacity-70">
              cases in flight
              <br />
              all clients · all branches
            </span>
            {portfolio.comparison ? (
              <span className="num rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
                {portfolio.comparison.delta > 0 ? "+" : ""}
                {portfolio.comparison.delta}%
              </span>
            ) : (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
                Live total
              </span>
            )}
          </div>
          <span
            aria-hidden
            className="absolute inset-x-4 bottom-0 h-1.5 rounded-t-full"
            style={{ background: "oklch(0.85 0.15 88 / 0.85)" }}
          />
        </div>

        <div className="space-y-3">
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            What would you like to do?
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
          {completion ? (
            <div className="flex items-baseline justify-between gap-2 rounded-[1.1rem] border border-white/80 bg-white/70 px-3 py-2.5 shadow-[var(--shadow-card)]">
              <span className="text-[11px] text-muted-foreground">{completion.label}</span>
              <span className="num text-base font-medium text-foreground">{completion.value}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
