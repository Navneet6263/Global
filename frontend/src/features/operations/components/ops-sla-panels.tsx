import type { ReactNode } from "react";

import { Section } from "@/components/layout/section";
import { formatPercent } from "@/lib/formatting";

export function OpsSlaKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "critical";
}) {
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-[11px] tracking-[0.07em] text-muted-foreground uppercase">{label}</p>
      <p
        className={
          tone === "critical"
            ? "num mt-1.5 text-[1.4rem] leading-none font-medium text-critical-foreground"
            : "num mt-1.5 text-[1.4rem] leading-none font-medium text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function OpsSlaPerformanceTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly { name: string; onTimePercent: number | null; volume: number }[];
}) {
  return (
    <Section title={title} description="Volume-weighted delivery in the selected reporting window.">
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.name} className="space-y-1">
              <div className="flex justify-between text-[12px]">
                <span className="text-foreground">{row.name}</span>
                <span className="num text-muted-foreground">
                  {row.onTimePercent === null ? "Not available" : formatPercent(row.onTimePercent)}{" "}
                  · {row.volume} cases
                </span>
              </div>
              {row.onTimePercent !== null ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={barTone(row.onTimePercent)}
                    style={{ width: `${row.onTimePercent}%` }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <OpsSlaEmptyMessage>No cases fall inside the selected reporting window.</OpsSlaEmptyMessage>
      )}
    </Section>
  );
}

export function OpsSlaEmptyMessage({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-xs text-muted-foreground">{children}</p>;
}

function barTone(percent: number) {
  if (percent >= 92) return "block h-full rounded-full bg-success";
  if (percent >= 87) return "block h-full rounded-full bg-warning";
  return "block h-full rounded-full bg-critical";
}
