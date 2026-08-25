import { Activity, BarChart3, CircleDot, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ExecutiveDashboard } from "@/lib/api/dashboards";
import type { ExecutiveDrilldownSelection } from "./ExecutiveDrilldown";

const statusColors: Record<string, string> = {
  COMPLETED: "bg-emerald-500",
  CLOSED: "bg-emerald-500",
  IN_PROGRESS: "bg-blue-500",
  QA_REVIEW: "bg-violet-500",
  CONSENT_PENDING: "bg-amber-500",
  DRAFT: "bg-stone-400",
  CANCELLED: "bg-red-500",
};

export function ExecutivePerformance({ data }: { data: ExecutiveDashboard }) {
  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-50 text-orange-700">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Delivery trajectory</h2>
            <p className="text-[10px] text-muted-foreground">Created versus completed volume</p>
          </div>
        </div>
        <span className="rounded-lg bg-secondary/70 px-2.5 py-1.5 text-[9px] font-bold text-muted-foreground">
          {data.trend.length} month view
        </span>
      </div>
      <div className="mt-4 h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="createdFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="completedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e7e5e4" strokeDasharray="3 5" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#78716c" }}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#78716c" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e7e5e4",
                boxShadow: "0 12px 30px -20px #000",
              }}
            />
            <Area
              type="monotone"
              dataKey="created"
              stroke="#f97316"
              strokeWidth={2.2}
              fill="url(#createdFill)"
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#10b981"
              strokeWidth={2.2}
              fill="url(#completedFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center gap-5 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
        <Legend color="bg-orange-500" label="Created" />
        <Legend color="bg-emerald-500" label="Completed" />
      </div>
    </section>
  );
}

export function PortfolioComposition({
  data,
  onDrilldown,
}: {
  data: ExecutiveDashboard;
  onDrilldown: (selection: ExecutiveDrilldownSelection) => void;
}) {
  const [lens, setLens] = useState<"status" | "risk">("status");
  const entries = Object.entries(lens === "status" ? data.statusMix : data.riskMix).sort(
    (a, b) => b[1] - a[1],
  );
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Portfolio composition</h2>
            <p className="text-[10px] text-muted-foreground">Current distribution</p>
          </div>
        </div>
        <div className="flex rounded-lg bg-secondary/70 p-1">
          {(["status", "risk"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLens(item)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize ${lens === item ? "bg-white shadow-sm" : "text-muted-foreground"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {entries.length ? (
          entries.map(([label, value]) => {
            const percent = total ? Math.round((value / total) * 100) : 0;
            const color =
              lens === "risk" ? riskColor(label) : (statusColors[label] ?? "bg-orange-500");
            return (
              <button
                type="button"
                onClick={() =>
                  lens === "status" &&
                  onDrilldown({ kind: "status", value: label, label: `${humanize(label)} cases` })
                }
                key={label}
                className={`block w-full text-left ${lens === "status" ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2 font-medium">
                    <CircleDot className="h-3 w-3 text-muted-foreground" />
                    {humanize(label)}
                  </span>
                  <span className="num text-muted-foreground">
                    {value} · {percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>
            );
          })
        ) : (
          <div className="grid h-48 place-items-center text-xs text-muted-foreground">
            <Activity className="mb-2 h-5 w-5" />
            No portfolio data yet
          </div>
        )}
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
function riskColor(value: string) {
  if (["CRITICAL", "HIGH"].includes(value)) return "bg-red-500";
  if (value === "MEDIUM") return "bg-amber-500";
  if (value === "LOW") return "bg-emerald-500";
  return "bg-stone-400";
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
