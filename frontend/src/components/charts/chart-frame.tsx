import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartFrameProps {
  title: string;
  insight: string;
  legend?: readonly { label: string; color: string }[];
  children: ReactNode;
  summary: string;
  className?: string;
}

/** Wraps a chart with an explanation, legend and a text summary for screen readers. */
export function ChartFrame({
  title,
  insight,
  legend,
  children,
  summary,
  className,
}: ChartFrameProps) {
  return (
    <figure className={cn("surface m-0 flex flex-col gap-4 p-5", className)}>
      <figcaption className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {legend ? (
            <ul className="flex flex-wrap items-center gap-3">
              {legend.map((entry) => (
                <li
                  key={entry.label}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  {entry.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{insight}</p>
      </figcaption>
      <div className="min-w-0">{children}</div>
      <p className="sr-only">{summary}</p>
    </figure>
  );
}
