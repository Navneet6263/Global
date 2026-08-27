"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { CrmTrendPoint } from "../contracts/crm";
import { Sparkline } from "@/components/charts/sparkline";
import { formatInr } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { crmAccent } from "../accents";

const SERIES = [
  { id: "pipeline", label: "Pipeline", accent: "openPipeline" },
  { id: "weighted", label: "Weighted", accent: "weightedForecast" },
  { id: "won", label: "Closed won", accent: "closedWon" },
] as const;

type SeriesId = (typeof SERIES)[number]["id"];

export function CrmTrendCard({ trend }: { trend: readonly CrmTrendPoint[] }) {
  const [seriesId, setSeriesId] = useState<SeriesId>("pipeline");
  const active = SERIES.find((item) => item.id === seriesId)!;
  const accent = crmAccent(active.accent);
  const points = trend.map((point) => ({ label: point.label, value: point[seriesId] }));
  const latest = points.at(-1)?.value ?? 0;
  const first = points[0]?.value ?? 0;
  const change = first === 0 ? 0 : ((latest - first) / first) * 100;

  return (
    <section className="flex flex-col rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
          Revenue trend
        </h2>
        <Link
          to="/sales-crm/forecast"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-mint-deep hover:underline"
        >
          Forecast
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="mt-3 inline-flex w-fit gap-1 rounded-full bg-mint-soft/70 p-1">
        {SERIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSeriesId(item.id)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
              seriesId === item.id
                ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-end gap-3">
        <span className="num text-[1.9rem] leading-none font-medium tracking-[-0.04em] text-foreground">
          {formatInr(latest, { compact: true })}
        </span>
        <span
          className="num mb-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ background: accent.fill, borderColor: accent.edge, color: accent.colour }}
        >
          {change > 0 ? "+" : ""}
          {change.toFixed(1)}% vs Mar
        </span>
      </div>

      <div className="mt-1 flex-1">
        <Sparkline data={points} tone="info" accent={accent.colour} height={132} />
      </div>
      <div className="flex justify-between px-1 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
        {trend.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </section>
  );
}
