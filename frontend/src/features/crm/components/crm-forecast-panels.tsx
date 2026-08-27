"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Coins, Flag, Gauge, Sparkles, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import type { RevenueForecast } from "../contracts/crm";
import { crmAccent, STAGE_ACCENT_KEYS } from "../accents";
import { formatInr } from "@/lib/formatting";

const AXIS = { stroke: "oklch(0.62 0.01 150)", fontSize: 11 } as const;

const SUMMARY: readonly {
  id: string;
  label: string;
  icon: LucideIcon;
  pick: (f: RevenueForecast) => number;
}[] = [
  { id: "openPipeline", label: "Open pipeline", icon: Wallet, pick: (f) => f.openPipeline },
  {
    id: "weightedForecast",
    label: "Weighted forecast",
    icon: Coins,
    pick: (f) => f.weightedForecast,
  },
  {
    id: "closedWon",
    label: "Commit (Negotiation+Won)",
    icon: Gauge,
    pick: (f) => f.commitForecast,
  },
  { id: "winRate", label: "Best case", icon: Sparkles, pick: (f) => f.bestCaseForecast },
  { id: "activeOwners", label: "Target", icon: Flag, pick: (f) => f.target },
  { id: "overdueFollowUps", label: "Gap to target", icon: TrendingUp, pick: (f) => f.gapToTarget },
];

export function CrmForecastSummary({ forecast }: { forecast: RevenueForecast }) {
  const target = forecast.target || 1;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {SUMMARY.map((card) => {
        const accent = crmAccent(card.id);
        const value = card.pick(forecast);
        const share = Math.max(0, Math.min(1, Math.abs(value) / target));
        const Icon = card.icon;

        return (
          <div
            key={card.id}
            className="relative overflow-hidden rounded-[1.5rem] border border-white/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]"
            style={{
              borderTop: `2px solid ${accent.edge}`,
              background: `linear-gradient(165deg, ${accent.fill} 0%, color-mix(in oklab, var(--card) 88%, transparent) 60%)`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-8 size-28 rounded-full blur-2xl"
              style={{ background: accent.fill }}
            />
            <div className="relative flex items-center gap-2.5">
              <span
                className="flex size-9 items-center justify-center rounded-xl border"
                style={{ background: accent.fill, borderColor: accent.edge, color: accent.colour }}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                {card.label}
              </p>
            </div>
            <p className="num relative mt-2.5 text-[1.5rem] leading-none font-medium tracking-[-0.03em] text-foreground">
              {formatInr(value, { compact: true })}
            </p>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(share * 100)}%`,
                  background: `linear-gradient(90deg, ${accent.edge}, ${accent.colour})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface BucketChartProps {
  title: string;
  buckets: readonly { label: string; value: number; weighted: number }[];
  accentId: string;
}

export function CrmForecastBuckets({ title, buckets, accentId }: BucketChartProps) {
  const accent = crmAccent(accentId);
  const gradientId = `bucket-${accentId}`;

  return (
    <section
      className="rounded-[1.6rem] border border-white/80 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm"
      style={{
        borderTop: `2px solid ${accent.edge}`,
        background: `linear-gradient(180deg, ${accent.wash} 0%, color-mix(in oklab, var(--card) 88%, transparent) 45%)`,
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: accent.colour }} aria-hidden />
        <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...buckets]} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent.colour} stopOpacity={0.95} />
                <stop offset="100%" stopColor={accent.colour} stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="oklch(0.93 0.008 150)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} {...AXIS} />
            <YAxis
              tickFormatter={(value: number) => formatInr(value, { compact: true })}
              tickLine={false}
              axisLine={false}
              width={70}
              {...AXIS}
            />
            <Tooltip
              cursor={{ fill: accent.wash }}
              formatter={(value: number) => formatInr(value)}
              contentStyle={{ borderRadius: 14, borderColor: "oklch(0.9 0.01 150)", fontSize: 12 }}
            />
            <Bar dataKey="weighted" radius={[10, 10, 6, 6]} maxBarSize={44}>
              {buckets.map((bucket, index) => (
                <Cell
                  key={bucket.label}
                  fill={
                    accentId === "openPipeline"
                      ? crmAccent(STAGE_ACCENT_KEYS[index % STAGE_ACCENT_KEYS.length] ?? accentId)
                          .colour
                      : `url(#${gradientId})`
                  }
                  fillOpacity={0.92}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
