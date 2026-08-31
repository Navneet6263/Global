import type { ComponentProps } from "react";

export function SaplingSymbol({ className, alt = "" }: ComponentProps<"img">) {
  return (
    <img src="/brand/sapling-global-mark.png" alt={alt} className={className} draggable={false} />
  );
}
