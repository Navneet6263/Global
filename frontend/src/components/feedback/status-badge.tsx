import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/contracts/common";
import { TONE_BADGE, TONE_DOT } from "@/lib/formatting/tones";

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  withDot?: boolean;
  className?: string;
}

export function StatusBadge({ label, tone, withDot = true, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_BADGE[tone],
        className,
      )}
    >
      {withDot ? (
        <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} aria-hidden />
      ) : null}
      {label}
    </span>
  );
}
