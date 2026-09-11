"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { SummaryCard as SummaryCardData } from "@/lib/contracts/dashboard";
import { Sparkline } from "@/components/charts/sparkline";
import { cn } from "@/lib/utils";

const WINDOWS = [
  { id: "three", label: "3 months", take: 3 },
  { id: "six", label: "6 months", take: 6 },
  { id: "all", label: "Available history", take: Infinity },
] as const;

export function TrendCard({ card }: { card: SummaryCardData }) {
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]["id"]>("six");
  const take = WINDOWS.find((item) => item.id === windowId)?.take ?? 6;
  const data = card.series.slice(-take);

  return (
    <section className="flex flex-col rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
          Monthly case intake
        </h2>
        <Link
          to="/admin/analytics"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-mint-deep hover:underline"
        >
          Show all
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="mt-3 inline-flex w-fit gap-1 rounded-full bg-mint-soft/70 p-1">
        {WINDOWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setWindowId(item.id)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
              windowId === item.id
                ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex-1">
        <Sparkline data={data} tone={card.tone} accent="var(--mint)" height={140} />
      </div>

      <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
        {data.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </section>
  );
}
