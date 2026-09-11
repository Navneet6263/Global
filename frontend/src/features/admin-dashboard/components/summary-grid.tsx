import type { PipelineStage, SummaryCard as SummaryCardData } from "@/lib/contracts/dashboard";
import { PortfolioCard } from "./portfolio-card";
import { TrendCard } from "./trend-card";
import { StatCard } from "./stat-card";
import { StageBarsCard } from "./stage-bars-card";
import { MetricTile } from "./metric-tile";

interface SummaryGridProps {
  cards: readonly SummaryCardData[];
  pipeline: readonly PipelineStage[];
}

export function SummaryGrid({ cards, pipeline }: SummaryGridProps) {
  const find = (id: string) => cards.find((card) => card.id === id);
  const portfolio = find("portfolio");
  const sla = find("sla-health");
  const completion = find("completion-time");
  const tiles = cards.filter(
    (card) => !["portfolio", "sla-health", "completion-time"].includes(card.id),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {portfolio ? <PortfolioCard portfolio={portfolio} completion={completion} /> : null}
        {portfolio ? <TrendCard card={portfolio} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        {sla ? <StatCard card={sla} /> : null}
        {completion ? <StatCard card={completion} /> : null}
        <StageBarsCard stages={pipeline} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((card) => (
          <MetricTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
