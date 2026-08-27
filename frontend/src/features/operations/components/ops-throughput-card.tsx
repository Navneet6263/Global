import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Section } from "@/components/layout/section";
import type { OpsDashboard } from "../contracts/operations";

export function OpsThroughputCard({ data }: { data: OpsDashboard["throughput"] }) {
  return (
    <Section
      title="Created vs completed"
      description="Last seven days of intake against released reports."
    >
      <div className="h-[236px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[...data]} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="opsCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--info)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--info)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="opsCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 14,
                border: "1px solid var(--border)",
                fontSize: 12,
                background: "var(--card)",
              }}
            />
            <Area
              type="monotone"
              dataKey="created"
              name="Created"
              stroke="var(--info)"
              strokeWidth={1.75}
              fill="url(#opsCreated)"
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke="var(--success)"
              strokeWidth={1.75}
              fill="url(#opsCompleted)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}
