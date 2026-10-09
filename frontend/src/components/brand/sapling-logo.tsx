import { cn } from "@/lib/utils";

/**
 * The Sapling Global wordmark used across every workspace (same artwork as the
 * Operations sidebar). `onDark` places it on a white chip so it reads on green panels.
 */
export function SaplingLogo({
  className,
  width = 160,
  onDark = false,
}: {
  className?: string;
  width?: number;
  onDark?: boolean;
}) {
  const image = (
    <img
      src="/brand/sapling-wordmark.png"
      width={width}
      height={Math.round((width * 60) / 260)}
      alt="Sapling Global"
      draggable={false}
      className={cn("block h-auto max-w-full select-none", !onDark && className)}
    />
  );
  if (!onDark) return image;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-2xl bg-white px-3.5 py-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,.35)]",
        className,
      )}
    >
      {image}
    </span>
  );
}
