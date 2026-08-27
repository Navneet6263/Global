interface RadialGaugeProps {
  /** 0 - 100 */
  value: number;
  label: string;
  caption?: string;
  colour: string;
  size?: number;
}

export function RadialGauge({ value, label, caption, colour, size = 96 }: RadialGaugeProps) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="num text-base font-medium tracking-[-0.02em] text-foreground">
            {clamped.toFixed(1)}%
          </span>
        </span>
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {label}
        </p>
        {caption ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{caption}</p>
        ) : null}
      </div>
    </div>
  );
}
