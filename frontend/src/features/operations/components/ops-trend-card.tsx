"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { OpsDashboard } from "../contracts/operations";
import { Sparkline } from "@/components/charts/sparkline";
import { cn } from "@/lib/utils";

const SERIES = [
  { id: "completed", label: "Completed" },
  { id: "created", label: "Created" },
] as const;

export function OpsTrendCard({ data }: { data: OpsDashboard["throughput"] }) {
  const [seriesId, setSeriesId] = useState<(typeof SERIES)[number]["id"]>("completed");
  const points = data.map((point) => ({
    label: point.label,
    value: seriesId === "completed" ? point.completed : point.created,
  }));

  return (
    <section className="flex flex-col rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
          Throughput
        </h2>
        <Link
          to="/operations/sla"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-mint-deep hover:underline"
        >
          SLA monitor
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

      <div className="mt-2 flex-1">
        <Sparkline data={points} tone="success" accent="var(--mint)" height={140} />
      </div>

      <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </section>
  );
}
