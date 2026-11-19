import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "border-brand bg-brand text-brand-fg hover:brightness-110",
  secondary: "border-line bg-surface text-ink hover:border-dim/60 hover:bg-subtle/60",
  ghost: "border-transparent bg-transparent text-dim hover:bg-subtle hover:text-ink",
  danger: "border-transparent bg-transparent text-bad hover:bg-bad-soft",
} as const;
const SIZES = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  icon: "size-9 p-0",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/** Classes for anything that should look like a button, e.g. a router Link. */
export const buttonClass = (
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  extra?: string,
) =>
  cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Keeps the label, shows a spinner and blocks clicks while work runs. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading = false, disabled, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
});

export function CountBadge({
  count,
  max = 99,
  tone = "bad",
}: {
  count?: number;
  max?: number;
  tone?: "bad" | "brand";
}) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "min-w-[18px] rounded-full px-1.5 text-center text-[11px] leading-[18px] font-bold",
        tone === "bad" ? "bg-bad text-brand-fg" : "bg-brand text-brand-fg",
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
