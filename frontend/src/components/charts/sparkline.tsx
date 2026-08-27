"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import type { StatusTone } from "@/lib/contracts/common";
import { TONE_STROKE } from "@/lib/formatting/tones";

interface SparklineProps {
  data: readonly { label: string; value: number }[];
  tone: StatusTone;
  height?: number;
  /** Optional explicit accent colour (CSS colour string) overriding the tone colour. */
  accent?: string;
  /** Amplify the vertical variation so flat-looking series still read as a wave. */
  amplify?: boolean;
}

const LAST_DOT = { r: 2.5, strokeWidth: 0 } as const;

export function Sparkline({ data, tone, height = 44, accent, amplify = true }: SparklineProps) {
  const colour = accent ?? TONE_STROKE[tone];
  const gradientId = `spark-${tone}-${data.length}-${Math.round(height)}`;
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  // Tight domain around the data => visible peaks and dips instead of a flat line.
  const domain: [number, number] = amplify
    ? [min - spread * 0.35, max + spread * 0.35]
    : [Math.min(0, min), max * 1.1];

  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 5, right: 4, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity={0.26} />
              <stop offset="70%" stopColor={colour} stopOpacity={0.06} />
              <stop offset="100%" stopColor={colour} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={domain} />
          <Area
            type="natural"
            dataKey="value"
            stroke={colour}
            strokeWidth={1.75}
            strokeLinecap="round"
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={false}
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Area
            type="natural"
            dataKey="value"
            stroke="none"
            fill="none"
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === data.length - 1 && props.cx != null && props.cy != null ? (
                <circle
                  key="tip"
                  cx={props.cx}
                  cy={props.cy}
                  r={LAST_DOT.r}
                  fill={colour}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                />
              ) : (
                <g key={`empty-${props.index}`} />
              )
            }
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
